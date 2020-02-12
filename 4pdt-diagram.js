const fourpdt = (() => {

    const EXTERNAL_CONNECTIONS = {
        FX_SEND: 'fx_send',
        FX_RETURN: 'fx_return',
        MAIN_IN: 'main_in',
        MAIN_OUT: 'main_out',
        RUBBERNECK_IN: 'rubberneck_in',
        RUBBERNECK_OUT: 'rubberneck_out',
    };

    const RENDER_LAYERS = {
        TERMINALS: 'terminals',  // Show the terminals without any connections.
        EXTERNAL_WIRES: 'external_wires', // Wires that go from the switch to an audio jack socket
        SWITCH: 'switch', // Internal connections that are changed by toggling the switch.
        INTERNAL_WIRES: 'internal_wires', // Wires you need to add to connect terminals of the switch.
        TERMINAL_LABELS: 'terminal_labels', // Show reference numbers on terminals.
        CONNECTION_LABELS: 'connection_labels', // Show a list of terminals that a given terminal should be connected to
        SIGNAL: 'signal', // Show the signal path through the circuit for the current switch state
    };

    const TAU = Math.PI * 2;

    const baseWidth = 800;
    const baseHeight = 600;

    const canvasWrapper = document.getElementById('fourpdt_diagram');
    const canvas = document.getElementById("fourpdt_diagram_canvas");
    const ctx = canvas.getContext("2d");

    const terminalRadius = 20;
    const terminalSpacing = terminalRadius * 4;
    const lineWidth = terminalRadius / 5;

    const fontSize = terminalRadius;

    ctx.lineWidth = lineWidth;
    ctx.font = `${fontSize}px sans-serif`;

    const COLORS = {
        LABEL: getCssVariable('--text-light-primary'),
        EXTERNAL_CONNECTION: getCssVariable('--text-primary'),
        SWITCH_CONNECTION: getCssVariable('--text-secondary'),
        GREEN: getCssVariable('--green'),
        BLUE: getCssVariable('--blue'),
        RED: getCssVariable('--red'),
        GREY: getCssVariable('--grey'),
        OVERLAY: getCssVariable('--overlay'),
        SIGNAL_GREEN: getCssVariable('--bright-green'),
        SIGNAL_BLUE: getCssVariable('--bright-blue'),
    };

    class Terminal {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.temporaryConnections = []; // Volatile connections made by flicking the switch
            this.permanentConnections = []; // Soldered wire connections
            this.color = COLORS.GREY;
            this.externalConnection = null;
            this.label = '';
            this.focussed = false; // Mouse hovering over
        }

        addTemporaryConnection(connection) {
            this.temporaryConnections.push(connection);
        }

        addPermanentConnection(connection) {
            this.permanentConnections.push(connection);
        }
    }

    class FourPDTSwitch {
        constructor() {
            this.renderLayers = [
                RENDER_LAYERS.TERMINALS,
                RENDER_LAYERS.EXTERNAL_WIRES,
                RENDER_LAYERS.SWITCH,
                RENDER_LAYERS.INTERNAL_WIRES,
                RENDER_LAYERS.SIGNAL,
                RENDER_LAYERS.TERMINAL_LABELS,
                RENDER_LAYERS.CONNECTION_LABELS,
            ];
            this.switchPosition = false;

            this.terminals = [];
            for (var i = 0; i < 12; i++) {
                this.terminals.push(
                    new Terminal(
                        (i % 4) * terminalSpacing + terminalSpacing,
                        Math.floor(i / 4) * terminalSpacing + terminalSpacing)
                    );

                this.terminals[i].label = `${i}`;
            }

            this.setColor([1, 5, 8, 11], COLORS.GREEN);
            this.setColor([0, 3, 6, 10], COLORS.BLUE);
            this.setColor([4, 7], COLORS.RED);

            // Green
            this.addPermanentConnection(1, 8);
            this.addPermanentConnection(5, 11);

            // Blue
            this.addPermanentConnection(0, 10);
            this.addPermanentConnection(3, 6);

            // Red
            this.addPermanentConnection(4, 7);

            // External connections
            this.terminals[8].externalConnection = EXTERNAL_CONNECTIONS.MAIN_IN;
            this.terminals[11].externalConnection = EXTERNAL_CONNECTIONS.MAIN_OUT;

            this.terminals[0].externalConnection = EXTERNAL_CONNECTIONS.RUBBERNECK_IN;
            this.terminals[3].externalConnection = EXTERNAL_CONNECTIONS.RUBBERNECK_OUT;

            this.terminals[4].externalConnection = EXTERNAL_CONNECTIONS.FX_SEND;
            this.terminals[7].externalConnection = EXTERNAL_CONNECTIONS.FX_RETURN;

            this.updateSignalPaths();
        }

        addTemporaryConnection(first, second) {
            this.terminals[first].addTemporaryConnection(second);
            this.terminals[second].addTemporaryConnection(first);
        }

        addPermanentConnection(first, second) {
            this.terminals[first].addPermanentConnection(second);
            this.terminals[second].addPermanentConnection(first);
        }

        toggle() {
            this.switchPosition = !this.switchPosition;

            this.terminals.forEach(terminal => terminal.temporaryConnections = []);

            if (this.switchPosition) {
                [0, 1, 2, 3].forEach(position => {
                    this.addTemporaryConnection(position, position + 4);
                });
            }
            else {
                [4, 5, 6, 7].forEach(position => {
                    this.addTemporaryConnection(position, position + 4);
                });
            }

            this.updateSignalPaths();
            this.draw();
        }

        setColor(terminalList, color) {
            terminalList.forEach(terminal => {
                this.terminals[terminal].color = color;
            });
        }

        draw() {
            ctx.clearRect(0, 0, baseWidth, baseHeight);

            if (this.shouldRender(RENDER_LAYERS.SWITCH)) {
                this.drawSwitchConnections();
            }

            if (this.shouldRender(RENDER_LAYERS.TERMINALS)) {
                this.drawTerminals();
            }

            if (this.shouldRender(RENDER_LAYERS.INTERNAL_WIRES)) {
                this.drawConnections();
            }

            if (this.shouldRender(RENDER_LAYERS.SIGNAL)) {
                this.drawSignal();
            }

            if (this.shouldRender(RENDER_LAYERS.TERMINAL_LABELS)) {
                this.drawTerminalLabels();
            }
        }

        shouldRender(layer) {
            return this.renderLayers.includes(layer);
        }

        drawTerminals() {
            this.terminals.forEach(terminal => {
                if (terminal.externalConnection) {
                    ctx.lineWidth = lineWidth * 2;
                    strokeCircle(terminal.x, terminal.y, terminalRadius, COLORS.EXTERNAL_CONNECTION);
                    ctx.lineWidth = lineWidth;
                }

                fillCircle(terminal.x, terminal.y, terminalRadius, terminal.color);

                if (terminal.focussed) {
                    fillCircle(terminal.x, terminal.y, terminalRadius / 3, COLORS.LABEL);
                }
            });
        }

        drawConnections() {
            this.terminals.forEach(terminal => {
                if ([
                    EXTERNAL_CONNECTIONS.FX_SEND, EXTERNAL_CONNECTIONS.FX_RETURN
                ].includes(terminal.externalConnection)) {
                    return;
                }

                const permanentConnections = terminal.permanentConnections;
                permanentConnections.forEach(connection => {
                    const other = this.terminals[connection];
                    drawLine(terminal.x, terminal.y, other.x, other.y, terminal.color);
                });
            });
        }

        drawSwitchConnections() {
            this.terminals.forEach(terminal => {
                terminal.temporaryConnections.forEach(connection => {
                    const other = this.terminals[connection];
                    drawLine(terminal.x, terminal.y, other.x, other.y, COLORS.SWITCH_CONNECTION);
                });
            });
        }

        drawTerminalLabels() {
            this.terminals.forEach(terminal => {
                const metrics = ctx.measureText(terminal.label);
                const left = terminal.x - (metrics.width / 2);
                const baseline = terminal.y + (fontSize / 3);

                fillCircle(terminal.x, terminal.y, terminalRadius * .66, COLORS.OVERLAY);

                ctx.fillStyle = COLORS.LABEL;
                ctx.fillText(terminal.label, left, baseline);
            })
        }

        drawSignal() {
            const greenPairs = pairwise(this.greenSignalPath);
            greenPairs.forEach(pair => {
                const first = this.terminals[pair[0]];
                const second = this.terminals[pair[1]];
                drawArrowWithOutline(first.x, first.y, second.x, second.y, COLORS.SIGNAL_GREEN);
            });

            const bluePairs = pairwise(this.blueSignalPath);
            bluePairs.forEach(pair => {
                const first = this.terminals[pair[0]];
                const second = this.terminals[pair[1]];
                drawArrowWithOutline(first.x, first.y, second.x, second.y, COLORS.SIGNAL_BLUE);
            });
        }

        onMouseOver(x, y) {
            this.terminals.forEach(terminal => {
                terminal.focussed = (distance(x, y, terminal.x, terminal.y) < terminalRadius);
            });
            draw();
        }

        updateSignalPaths() {
            this.blueSignalPath = this.findSignalPath(0);
            this.greenSignalPath = this.findSignalPath(8);
        }

        findSignalPath(startTerminal) {
            const _this = this;
            const signalOutputs = [3, 11];

            function findOutput(terminalId, visitedTerminals) {
                if (visitedTerminals.has(terminalId)) {
                    return [];
                }
                visitedTerminals.add(terminalId);

                const terminal = _this.terminals[terminalId];
                const connections = terminal.temporaryConnections.concat(terminal.permanentConnections).filter((el) => !visitedTerminals.has(el));
                var connected = [];
                connections.forEach(c => {
                    if (signalOutputs.includes(c)) {
                        connected.push(c);
                    }
                    else {
                        const cons = findOutput(c, visitedTerminals);
                        if (cons.length > 0) {
                            connected.push(c);
                            connected = connected.concat(cons);
                        }
                    }
                });

                const found = connected.some(r => signalOutputs.includes(r));
                if (found) {
                    return connected;
                }
                else {
                    return [];
                }
            }

            return [startTerminal].concat(findOutput(startTerminal, new Set()));
        }
    }

    function draw() {
        _switch.draw();
    }

    function drawLine(startX, startY, endX, endY, color) {
        if (color != null) ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    function drawArrowWithOutline(startX, startY, endX, endY, color) {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.fillStyle = COLORS.OVERLAY;
        ctx.fill();

        plotArrowHead(startX, startY, endX, endY);
        ctx.strokeStyle = COLORS.OVERLAY;
        ctx.stroke();

        drawArrow(startX, startY, endX, endY, color);
    }

    function plotArrowHead(startX, startY, endX, endY) {
        const arrowSize = lineWidth * 5;
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle - Math.PI / 6),
            endY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            endX - arrowSize * Math.cos(angle + Math.PI / 6),
            endY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
    }

    function drawArrow(startX, startY, endX, endY, color) {
        if (color != null) {
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
        }

        plotArrowHead(startX, startY, endX, endY);

        ctx.strokeStyle = COLORS.OVERLAY;
        ctx.fill();

        drawLine(startX, startY, endX, endY, color);
    }

    function strokeCircle(x, y, radius, strokeStyle) {
        if (strokeStyle != null) ctx.strokeStyle = strokeStyle;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.stroke();
    }

    function fillCircle(x, y, radius, fillStyle) {
        if (fillStyle != null) ctx.fillStyle = fillStyle;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
    }

    function toggle() {
        _switch.toggle();
    }

    function onMouseOver(event) {
        const rect = canvas.getBoundingClientRect();
        _switch.onMouseOver(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    }

    function distance(x1, y1, x2, y2) {
        return Math.sqrt(
            Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
        )
    }

    function pairwise(list) {
        var output = [];
        console.log(list.length);
        for (var i = 0; i < list.length - 1; i++) {
            output.push([list[i], list[i + 1]]);
        }
        return output;
    }

    function getCssVariable(key) {
        return getComputedStyle(document.documentElement).getPropertyValue(key);
    }

    // Run on load
    const _switch = new FourPDTSwitch();

    document.getElementById('fourpdt_toggle').addEventListener('click', toggle);
    // canvas.addEventListener('mousemove', onMouseOver);

    toggle();

    // Exports
    return {
        draw: draw,
        toggle: toggle,
    }
})();
