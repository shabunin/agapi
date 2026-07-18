import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { CFNode } from '../parser';
import { joinStore } from '../joinStore';
import { CFRenderer } from '../renderer';

export function renderWeb(
    node: CFNode,
    container: Container,
    renderer: CFRenderer
) {
    const webJoin = (node.j && node.j !== "0") ? node.j : null;
    
    // In a real application, you would create an IFRAME DOM element and position it over the canvas.
    // For PixiJS natively, we can only draw a placeholder.
    const placeholder = new Graphics().rect(0, 0, node.w, node.h).fill({ color: 0x333333, alpha: 0.9 }).stroke({ color: 0x666666, width: 2 });
    container.addChild(placeholder);

    const txt = new Text({
        text: "Web View",
        style: new TextStyle({ fill: '#ffffff', fontSize: 16, align: 'center' })
    });
    txt.x = node.w / 2;
    txt.y = node.h / 2;
    txt.anchor.set(0.5);
    container.addChild(txt);

    const updateUrl = (url: string) => {
        if (!url) return;
        txt.text = `Web View\n${url}`;
        // Update iframe src here if it existed
    };

    const initVal = (webJoin && joinStore.has(webJoin, "s")) ? joinStore.get(webJoin, "s") : node.content;
    if (typeof initVal === 'string') updateUrl(initVal);
    
    if (webJoin) {
        joinStore.on(webJoin, "s", (val) => {
            if (container.destroyed) return;
            if (typeof val === 'string') updateUrl(val);
        });
    }
}
