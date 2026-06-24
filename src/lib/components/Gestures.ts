import { Container } from 'pixi.js';
import { CFNode } from '../parser';

export function bindGestures(container: Container, gestures: CFNode[]) {
    if (!gestures || gestures.length === 0) return;

    container.eventMode = 'dynamic';

    let isPointerDown = false;
    let startX = 0;
    let startY = 0;

    const executeAction = (gestureNode: CFNode, phase: string, x: number, y: number) => {
        gestureNode.children.forEach(c => {
            if (c.type === 'action' && c.attributes.phase === phase && c.attributes.js) {
                try {
                    const func = new Function("gesture", c.attributes.js);
                    const gesture = {
                        type: gestureNode.attributes.type || 'pan',
                        x: x,
                        y: y,
                        startx: startX,
                        starty: startY,
                        deltax: x - startX,
                        deltay: y - startY
                    };
                    func.call(window, gesture);
                } catch (e) {
                    console.error(`Error executing gesture action JS for phase ${phase}:`, e);
                }
            }
        });
    };

    container.on('pointerdown', (e) => {
        isPointerDown = true;
        startX = e.global.x;
        startY = e.global.y;

        gestures.forEach(g => {
            if (g.attributes.type === 'pan' || g.attributes.type === 'swipe') {
                executeAction(g, 'begin', e.global.x, e.global.y);
            }
        });
    });

    container.on('pointermove', (e) => {
        if (!isPointerDown) return;

        gestures.forEach(g => {
            if (g.attributes.type === 'pan') {
                executeAction(g, 'change', e.global.x, e.global.y);
            } else if (g.attributes.type === 'swipe') {
                executeAction(g, 'change', e.global.x, e.global.y);
            }
        });
    });

    const pointerUpOrOutside = (e: any) => {
        if (!isPointerDown) return;
        isPointerDown = false;

        const endX = e.global.x;
        const endY = e.global.y;

        gestures.forEach(g => {
            if (g.attributes.type === 'pan') {
                executeAction(g, 'end', endX, endY);
            } else if (g.attributes.type === 'swipe') {
                executeAction(g, 'end', endX, endY);
                // Can also add swipe threshold logic here if needed for trigger
            }
        });
    };

    container.on('pointerup', pointerUpOrOutside);
    container.on('pointerupoutside', pointerUpOrOutside);
}
