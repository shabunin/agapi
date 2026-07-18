import { Container } from 'pixi.js';
import { CFNode } from '../parser';
import { CFRenderer } from '../renderer';
import { joinStore } from '../joinStore';
import gsap from 'gsap';

export function renderSubpage(
    node: CFNode,
    container: Container,
    renderer: CFRenderer
) {
    const subName = node.name;
    if (subName && renderer.project.subpages[subName]) {
        const def = renderer.project.subpages[subName];
        const subCont = renderer.createSubpage(def);
        container.addChild(subCont);
        
        const transition1 = node.attributes.transition1;
        const subtype1 = node.attributes.subtype1;
        const time1 = parseFloat(node.attributes.time1 || "0");
        const ease1 = node.attributes.ease1;
        
        const transition2 = node.attributes.transition2;
        const subtype2 = node.attributes.subtype2;
        const time2 = parseFloat(node.attributes.time2 || "0");
        const ease2 = node.attributes.ease2;

        const animateSubpage = (isVisible: boolean, instant: boolean = false) => {
            gsap.killTweensOf(subCont);
            gsap.killTweensOf(subCont.scale);

            if (instant) {
                subCont.visible = isVisible;
                subCont.alpha = 1;
                subCont.x = 0;
                subCont.y = 0;
                subCont.scale.set(1);
                return;
            }

            if (isVisible) {
                // ENTRY
                if (!subCont.visible) {
                    subCont.visible = true;
                    if (time1 > 0 && transition1 && transition1 !== "None") {
                        applyTransition(subCont, true, transition1, subtype1, time1, ease1, renderer);
                    } else {
                        subCont.alpha = 1;
                        subCont.x = 0;
                        subCont.y = 0;
                        subCont.scale.set(1);
                    }
                }
            } else {
                // EXIT
                if (subCont.visible) {
                    if (time2 > 0 && transition2 && transition2 !== "None") {
                        applyTransition(subCont, false, transition2, subtype2, time2, ease2, renderer).then(() => {
                            subCont.visible = false;
                        });
                    } else {
                        subCont.visible = false;
                    }
                }
            }
        };

        const dJoin = node.j;
        if (dJoin && dJoin !== "0") {
            const initialVal = !!joinStore.get(dJoin, "d");
            animateSubpage(initialVal, true);
            
            joinStore.on(dJoin, "d", (val) => {
                if (container.destroyed) return;
                animateSubpage(!!val, false);
            });
        } else {
            const initialVal = node.v !== "0";
            animateSubpage(initialVal, true);
        }
    }
}

function applyTransition(target: Container, isEntry: boolean, transition: string, subtype: string, time: number, easeStr: string, renderer: CFRenderer): Promise<void> {
    return new Promise((resolve) => {
        let ease = "none";
        if (easeStr === "easeIn") ease = "power2.in";
        else if (easeStr === "easeOut") ease = "power2.out";
        else if (easeStr === "easeInOut") ease = "power2.inOut";

        target.alpha = 1;
        target.x = 0;
        target.y = 0;
        target.scale.set(1);
        
        let fromProps: any = {};
        let toProps: any = {};

        const tLower = transition.toLowerCase();
        if (tLower === "movein" || tLower === "reveal" || tLower === "push") {
            const maxW = Math.max(renderer.app.screen.width, 2000);
            const maxH = Math.max(renderer.app.screen.height, 2000);
            
            const dx = (subtype === "fromLeft") ? -maxW : (subtype === "fromRight" ? maxW : 0);
            const dy = (subtype === "fromTop") ? -maxH : (subtype === "fromBottom" ? maxH : 0);
            
            if (isEntry) {
                fromProps = { x: dx, y: dy };
                toProps = { x: 0, y: 0 };
            } else {
                fromProps = { x: 0, y: 0 };
                toProps = { x: dx, y: dy };
            }
        } else if (tLower === "fade") {
            if (isEntry) {
                fromProps = { alpha: 0 };
                toProps = { alpha: 1 };
            } else {
                fromProps = { alpha: 1 };
                toProps = { alpha: 0 };
            }
        } else if (tLower === "scale") {
            if (isEntry) {
                fromProps = { scaleX: 0.01, scaleY: 0.01 };
                toProps = { scaleX: 1, scaleY: 1 };
            } else {
                fromProps = { scaleX: 1, scaleY: 1 };
                toProps = { scaleX: 0.01, scaleY: 0.01 };
            }
        }

        if (fromProps.x !== undefined) target.x = fromProps.x;
        if (fromProps.y !== undefined) target.y = fromProps.y;
        if (fromProps.alpha !== undefined) target.alpha = fromProps.alpha;
        if (fromProps.scaleX !== undefined) {
            target.scale.set(fromProps.scaleX, fromProps.scaleY);
        }

        const tweenProps: any = { duration: time, ease, onComplete: resolve };
        if (toProps.x !== undefined) tweenProps.x = toProps.x;
        if (toProps.y !== undefined) tweenProps.y = toProps.y;
        if (toProps.alpha !== undefined) tweenProps.alpha = toProps.alpha;
        
        gsap.to(target, tweenProps);
        
        if (toProps.scaleX !== undefined) {
            gsap.to(target.scale, { x: toProps.scaleX, y: toProps.scaleY, duration: time, ease });
        }
    });
}
