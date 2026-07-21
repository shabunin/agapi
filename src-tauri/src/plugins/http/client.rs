use std::collections::HashMap;
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct HttpClientRequestArgs {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<Vec<u8>>,
}

#[derive(Serialize)]
pub struct HttpClientResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

#[tauri::command]
pub async fn http_client_request(
    args: HttpClientRequestArgs,
) -> Result<HttpClientResponse, String> {
    // CF/iViewer talks to local gear (UPnP/Sonos/etc.) with self-signed HTTPS
    // and often bare IP hostnames. Default webpki validation rejects those.
    let client = Client::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("http client build: {}", e))?;

    let method = match Method::from_bytes(args.method.as_bytes()) {
        Ok(m) => m,
        Err(_) => return Err(format!("Invalid HTTP method: {}", args.method)),
    };

    let mut request_builder = client.request(method, &args.url);

    for (k, v) in args.headers {
        request_builder = request_builder.header(k, v);
    }

    if let Some(body_bytes) = args.body {
        request_builder = request_builder.body(body_bytes);
    }

    let response = match request_builder.send().await {
        Ok(res) => res,
        Err(e) => {
            // Surface TLS/connect details for debugging CF.request failures
            let mut msg = e.to_string();
            if e.is_connect() {
                msg = format!("connect error: {}", msg);
            }
            if e.is_timeout() {
                msg = format!("timeout: {}", msg);
            }
            if e.is_request() {
                msg = format!("request error: {}", msg);
            }
            // Common case: certificate / hostname
            if let Some(source) = std::error::Error::source(&e) {
                msg = format!("{} ({})", msg, source);
            }
            return Err(msg);
        }
    };

    let status = response.status().as_u16();
    
    let mut res_headers: HashMap<String, String> = HashMap::new();
    for (k, v) in response.headers() {
        if let Ok(v_str) = v.to_str() {
            // Append multiple values for the same header (e.g. Set-Cookie)
            // But for simple HashMap we might overwrite. Let's just do single values for now.
            // A more complete implementation might use `Vec<String>` for values.
            if let Some(existing) = res_headers.get_mut(k.as_str()) {
                existing.push_str(", ");
                existing.push_str(v_str);
            } else {
                res_headers.insert(k.as_str().to_string(), v_str.to_string());
            }
        }
    }

    let body_bytes = match response.bytes().await {
        Ok(b) => b.to_vec(),
        Err(e) => return Err(e.to_string()),
    };

    Ok(HttpClientResponse {
        status,
        headers: res_headers,
        body: body_bytes,
    })
}
