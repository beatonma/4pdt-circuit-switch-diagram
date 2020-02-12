const switches = (() => {
    // External connections to jacks
    const EXTERNAL = {
        FX_SEND: 'fx_send',
        FX_RETURN: 'fx_return',
        MAIN_IN: 'main_in',
        MAIN_OUT: 'main_out',
        RUBBERNECK_IN: 'rubberneck_in', // Send from Rubberneck
        RUBBERNECK_OUT: 'rubberneck_out', // Return to Rubberneck
    };

    const EXTERNAL_ABOUT = {
        'fx_send': 'FX SEND: send signal to pedals in our effects loop.',
        'fx_return': 'FX RETURN: receive signal from pedals in our effects loop.',
        'main_in': 'Main IN: connected to pedals that come before the switch.',
        'main_out': 'Main OUT: connected to pedals that come after the switch.',
        'rubberneck_in': 'Rubberneck IN: receive signal from Rubberneck SEND.', // Send from Rubberneck
        'rubberneck_out': 'Rubberneck OUT: return signal to Rubberneck RETURN.', // Return to Rubberneck
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

    const canvas = document.getElementById("single_switch_canvas");
    const infoLabel = document.getElementById("single_switch_label");

    function pairwise(list) {
        var output = [];
        for (var i = 0; i < list.length - 1; i++) {
            output.push([list[i], list[i + 1]]);
        }
        return output;
    }

const switch_models = (() => {
    class Terminal {
        constructor(id) {
            this.temporaryConnections = []; // Volatile connections made by flicking the switch
            this.permanentConnections = []; // Soldered wire connections
            this.externalConnection = null;
            this.id = id;
            this.label = `${id + 1}`;
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
            this.switchPosition = false;

            this.terminals = [];
            for (var id = 0; id < 12; id++) {
                this.terminals.push(
                    new Terminal(id)
                );
            }
            this.signalPaths = [];
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
        }

        updateSignalPaths() {
            const signalInputs = this.terminals.filter(terminal => [
                EXTERNAL.MAIN_IN, EXTERNAL.RUBBERNECK_IN,
            ].includes(terminal.externalConnection)).map(terminal => terminal.id);

            this.signalPaths = signalInputs.map(input => this.findSignalPath(input));
        }

        findSignalPath(startTerminal) {
            const _this = this;
            const signalOutputs = this.terminals.filter(terminal => [
                EXTERNAL.MAIN_OUT, EXTERNAL.RUBBERNECK_OUT,
            ].includes(terminal.externalConnection)).map(terminal => terminal.id);

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


    /* Create a switch and wire it up. */
    function createSingleSwitch() {
        const sw = new FourPDTSwitch();

        // Create an equivalent circuit by using different internal switches of the 4PDT switch.
        // Just a convenience for trying to find the least messy arrangement for display. Not used in production.
        function rewire(terminals, offset) {
            function _offset(num) {
                if (num < 4) return (num + offset) % 4;
                if (num < 8) return ((num + offset) % 4) + 4;
                return ((num + offset) % 4) + 8;
            }

            var rewired = new Array(12);
            terminals.forEach(t => {
                const originalId = t.id;
                t.id = _offset(originalId);
                t.permanentConnections = t.permanentConnections.map(connection => _offset(connection));
                rewired[t.id] = t;
            });

            return rewired;
        }

        sw.terminals[10].externalConnection = EXTERNAL.MAIN_IN;
        sw.terminals[11].externalConnection = EXTERNAL.MAIN_OUT;
        sw.addPermanentConnection(0, 10);
        sw.addPermanentConnection(4, 11);

        sw.terminals[2].externalConnection = EXTERNAL.RUBBERNECK_IN;
        sw.terminals[3].externalConnection = EXTERNAL.RUBBERNECK_OUT;
        sw.addPermanentConnection(2, 9);
        sw.addPermanentConnection(3, 5);

        sw.terminals[6].externalConnection = EXTERNAL.FX_SEND;
        sw.terminals[7].externalConnection = EXTERNAL.FX_RETURN;
        sw.addPermanentConnection(6, 7);

        // sw.terminals = rewire(sw.terminals, 1);

        sw.toggle();

        return sw;
    }

    return {
        single: createSingleSwitch,
    }
})();


const switch_renderer = (() => {

    const TAU = Math.PI * 2;

    const COLORS = {
        LABEL: getCssVariable('--text-light-primary'),
        EXTERNAL_TERMINAL: getCssVariable('--text-primary'),
        EXTERNAL_CONNECTION: getCssVariable('--text-primary-invert'),
        SWITCH_CONNECTION: getCssVariable('--text-secondary'),
        GREY: getCssVariable('--grey'),
        MAIN_IO: getCssVariable('--green'),
        RUBBERNECK_IO: getCssVariable('--blue'),
        FX_LOOP: getCssVariable('--red'),
        OVERLAY: getCssVariable('--overlay'),
    };

    const TERMINAL_COLORS = {
        'fx_send': COLORS.FX_LOOP,
        'fx_return': COLORS.FX_LOOP,
        'main_in': COLORS.MAIN_IO,
        'main_out': COLORS.MAIN_IO,
        'rubberneck_in': COLORS.RUBBERNECK_IO,
        'rubberneck_out': COLORS.RUBBERNECK_IO,
        'default': COLORS.GREY,
    };

    const maxHeight = 600;
    const canvasRatio = 4/5;
    var canvasWidth = 400;
    var canvasHeight = 320;

    var terminalSpacing = canvasWidth / 5;
    var terminalRadius = terminalSpacing / 4;
    var lineWidth = terminalRadius / 5;
    var arrowSize = lineWidth * 3;

    var fontSize = terminalRadius;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = lineWidth;
    ctx.font = `${fontSize}px sans-serif`;

    function rescale() {
        canvasWidth = canvas.clientWidth;
        canvasHeight = canvas.clientHeight;
        terminalSpacing = canvasWidth / 5;
        terminalRadius = terminalSpacing / 4;
        lineWidth = terminalRadius / 5;
        arrowSize = lineWidth * 3;
        fontSize = terminalRadius;
    }

    class TerminalRenderer {
        constructor(terminal, x, y) {
            this.terminal = terminal;
            this._x = x;
            this._y = y;
            this.color = COLORS.GREY;
            this.focussed = false; // Mouse hovering over
            this.rescale();
        }

        rescale() {
            this.x = this.measuredX();
            this.y = this.measuredY();
        }

        measuredX() {
            return this._x * terminalSpacing + terminalSpacing;
        }

        measuredY() {
            return this._y * terminalSpacing + terminalSpacing;
        }
    }

    class FourPDTSwitchRenderer {
        constructor(fourpdtswitch) {
            this.renderLayers = [
                RENDER_LAYERS.TERMINALS,
                RENDER_LAYERS.EXTERNAL_WIRES,
                RENDER_LAYERS.SWITCH,
                RENDER_LAYERS.INTERNAL_WIRES,
                RENDER_LAYERS.SIGNAL,
                RENDER_LAYERS.TERMINAL_LABELS,
                RENDER_LAYERS.CONNECTION_LABELS,
            ];

            this.switch = fourpdtswitch;
            this.terminals = this.switch.terminals.map(terminal => {
                const trenderer = new TerminalRenderer(
                    terminal,
                    (terminal.id % 4),
                    Math.floor(terminal.id / 4)
                );
                return trenderer;
            });
        }

        applyTerminalColors() {
            this.switch.terminals.forEach(terminal => {
                if (terminal.externalConnection in TERMINAL_COLORS) {
                    this.terminals[terminal.id].color = TERMINAL_COLORS[terminal.externalConnection];
                }
                // else {
                //     this.terminals[terminal.id].color = TERMINAL_COLORS['default'];
                // }
            });
        }

        rescale() {
            this.terminals.forEach(t => t.rescale());
        }

        draw() {
            this.applyTerminalColors();
            if (this.shouldRender(RENDER_LAYERS.SIGNAL) || this.shouldRender(RENDER_LAYERS.INTERNAL_WIRES)) {
                this.switch.signalPaths.forEach(path => {
                    const first = path[0];
                    const color = TERMINAL_COLORS[this.switch.terminals[first].externalConnection];

                    path.forEach(t => this.terminals[t].color = color);
                });
            }

            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            if (this.shouldRender(RENDER_LAYERS.SWITCH)) {
                this.drawSwitchConnections();
            }

            if (this.shouldRender(RENDER_LAYERS.EXTERNAL_WIRES)) {
                this.drawExternalConnections();
            }

            if (this.shouldRender(RENDER_LAYERS.INTERNAL_WIRES)) {
                this.drawConnections();
            }

            if (this.shouldRender(RENDER_LAYERS.SIGNAL)) {
                this.drawSignal();
            }

            if (this.shouldRender(RENDER_LAYERS.TERMINALS)) {
                this.drawTerminals();
            }

            if (this.shouldRender(RENDER_LAYERS.TERMINAL_LABELS)) {
                this.drawTerminalLabels();
            }
        }

        shouldRender(layer) {
            return this.renderLayers.includes(layer);
        }

        drawTerminals() {
            this.terminals.forEach(renderer => {
                if (renderer.terminal.externalConnection != null) {
                    ctx.save();
                    ctx.globalAlpha = .5;
                    ctx.lineWidth = lineWidth * 2;
                    strokeCircle(renderer.x, renderer.y, terminalRadius, TERMINAL_COLORS[renderer.terminal.externalConnection]);
                    ctx.lineWidth = lineWidth;
                    ctx.restore();
                }

                fillCircle(renderer.x, renderer.y, terminalRadius, renderer.color);
            });
        }

        drawConnections() {
            if (this.renderLayers.includes(RENDER_LAYERS.SIGNAL)) {
                // Fade wired connections to make signals stand out more.
                ctx.save();
                ctx.globalAlpha = .1;
            }
            this.terminals.forEach(renderer => {
                // Don't render line that goes through fx loop.
                if ([
                    EXTERNAL.FX_SEND,
                    EXTERNAL.FX_RETURN,
                ].includes(renderer.terminal.externalConnection)) {
                    return;
                }

                const permanentConnections = renderer.terminal.permanentConnections;
                permanentConnections.forEach(connection => {
                    const other = this.terminals[connection];
                    drawLine(...indentLine(renderer.x, renderer.y, other.x, other.y), renderer.color);
                });
            });
            if (this.renderLayers.includes(RENDER_LAYERS.SIGNAL)) {
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }

        drawSwitchConnections() {
            this.terminals.forEach(renderer => {
                renderer.terminal.temporaryConnections.forEach(connection => {
                    const other = this.terminals[connection];
                    drawLine(...indentLine(renderer.x, renderer.y, other.x, other.y), COLORS.SWITCH_CONNECTION);
                });
            });
        }

        drawTerminalLabels() {
            this.terminals.forEach(renderer => {
                const metrics = ctx.measureText(renderer.terminal.label);
                const left = renderer.x - (metrics.width / 2);
                const baseline = renderer.y + (fontSize / 3);

                ctx.strokeStyle = COLORS.OVERLAY;
                ctx.strokeText(renderer.terminal.label, left, baseline);

                ctx.fillStyle = COLORS.LABEL;
                ctx.fillText(renderer.terminal.label, left, baseline);
            });
        }

        drawExternalConnections() {
            this.terminals.forEach(renderer => {
                const ext = renderer.terminal.externalConnection;
                switch(ext) {
                    case null:
                        break;
                    case EXTERNAL.RUBBERNECK_IN:
                    case EXTERNAL.MAIN_IN:
                    case EXTERNAL.FX_SEND:
                        drawArrowWithOutline(...indentLine(renderer.x - terminalRadius, renderer.y, renderer.x - terminalRadius * 2, renderer.y + terminalRadius), COLORS.EXTERNAL_CONNECTION);
                        break;
                    case EXTERNAL.RUBBERNECK_OUT:
                    case EXTERNAL.MAIN_OUT:
                    case EXTERNAL.FX_RETURN:
                        drawArrowWithOutline(...indentLine(renderer.x + terminalRadius * 2, renderer.y + terminalRadius, renderer.x + terminalRadius, renderer.y), COLORS.EXTERNAL_CONNECTION);
                        break;
                }
            });
        }

        drawSignal() {
            this.switch.signalPaths.forEach(path => {
                const color = this.terminals[path[0]].color;
                const pairs = pairwise(path);
                pairs.forEach(pair => {
                    const first = this.terminals[pair[0]];
                    const second = this.terminals[pair[1]];
                    const between = this.lineBetween(first, second);
                    drawArrowWithOutline(...between, color);
                });
            });
        }

        // Get start/end points for a line between two terminals, without drawing on top of those terminals
        lineBetween(t1, t2) {
            return indentLine(t1.x, t1.y, t2.x, t2.y);
        }

        onMouseOver(x, y) {
            this.terminals.forEach(renderer => {
                renderer.focussed = (distance(x, y, renderer.x, renderer.y) < terminalRadius);
                if (renderer.focussed) {
                    this.showTerminalInfo(renderer.terminal);
                }
            });
            this.draw();
        }

        showTerminalInfo(terminal) {
            var message = `<h3>Pin ${terminal.label}</h3>`;
            if (terminal.externalConnection != null) {
                message = `${message}${EXTERNAL_ABOUT[terminal.externalConnection]}<br/>`;
            }

            const connections = terminal.permanentConnections.map(c => this.terminals[c].terminal.label);
            if (connections.length > 0) {
                message = `${message}Wired connection to ${connections.join(', ')}.`;
            }
            else {
                message = `${message}No wired connections.`;
            }
            infoLabel.innerHTML = message;
        }
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
        ctx.fillStyle = ctx.strokeStyle = COLORS.OVERLAY;
        ctx.lineWidth = lineWidth * 2;
        ctx.stroke();

        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        plotArrowHead(startX, startY, endX, endY);
        ctx.strokeStyle = COLORS.OVERLAY;
        ctx.stroke();

        drawArrow(startX, startY, endX, endY, color);
    }

    function plotArrowHead(startX, startY, endX, endY) {
        const angle = gradientOf(startX, startY, endX, endY);

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

        ctx.fill();

        drawLine(...indentLine(startX, startY, endX, endY, 0, arrowSize * .5), color);
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

    function drawCurve(startX, startY, endX, endY, color) {
        // returns an array of x,y coordinates to graph a perfect curve between 2 points.
        ctx.beginPath();
        ctx.moveTo(startX, startY);

        for (var t = 0.0; t <= 1; t += .01) {
            ctx.lineTo(
                Math.round((1 - t) * (1 - t) * startX + 2 * (1 - t) * t * startX + t * t * endX),
                Math.round((1 - t) * (1 - t) * startY + 2 * (1 - t) * t * endY + t * t * endY)
            );
        }

        ctx.strokeStyle = color;
        ctx.stroke();
    }

    function getCssVariable(key) {
        return getComputedStyle(document.documentElement).getPropertyValue(key);
    }

    function distance(x1, y1, x2, y2) {
        return Math.sqrt(
            Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
        )
    }

    function gradientOf(startX, startY, endX, endY) {
        const dx = endX - startX;
        const dy = endY - startY;
        return  Math.atan2(dy, dx);
    }

    // Return start/end points for a shorter line with the same gradient
    function indentLine(startX, startY, endX, endY, startIndent, endIndent) {
        if (startIndent == null) startIndent = terminalRadius * 1.2;
        if (endIndent == null) endIndent = terminalRadius * 1.2;
        const d = distance(startX, startY, endX, endY)
        const startD2 = d - startIndent;
        const startT = startD2 / d;
        const endD2 = d - endIndent;
        const endT = endD2 / d;

        return [
            startT * startX + (1 - startT) * endX,
            startT * startY + (1 - startT) * endY,
            (1 - endT) * startX + endT * endX,
            (1 - endT) * startY + endT * endY,
        ]
    }

    return {
        renderer: FourPDTSwitchRenderer,
        rescale: rescale,
    }
})();

const singleSwitch = (() => {
    const singleSwitch = switch_models.single();
    const renderer = new switch_renderer.renderer(singleSwitch);

    function toggle() {
        singleSwitch.toggle();
        renderer.draw();
    }

    function rescale() {
        switch_renderer.rescale();
        renderer.rescale();
        renderer.draw();
    }

    function onMouseOver(event) {
        const rect = canvas.getBoundingClientRect();
        renderer.onMouseOver(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    }

    function toggleLayer(layer) {
        if (renderer.renderLayers.includes(layer)) {
            renderer.renderLayers = renderer.renderLayers.filter(item => item != layer);
        }
        else {
            renderer.renderLayers.push(layer);
        }
    }

    function showLayer(layer) {
        if (!renderer.renderLayers.includes(layer)) {
            renderer.renderLayers.push(layer);
        }
    }

    function hideLayer(layer) {
        if (renderer.renderLayers.includes(layer)) {
            renderer.renderLayers = renderer.renderLayers.filter(item => item != layer);
        }
    }

    function showSignalPath() {
        showLayer(RENDER_LAYERS.SIGNAL);
        showLayer(RENDER_LAYERS.INTERNAL_WIRES);
        showLayer(RENDER_LAYERS.SWITCH);
        renderer.draw();
    }

    function showWiredConnections() {
        showLayer(RENDER_LAYERS.INTERNAL_WIRES);
        showLayer(RENDER_LAYERS.SWITCH);
        hideLayer(RENDER_LAYERS.SIGNAL);
        renderer.draw();
    }

    function showTerminals() {
        hideLayer(RENDER_LAYERS.INTERNAL_WIRES);
        hideLayer(RENDER_LAYERS.SWITCH);
        hideLayer(RENDER_LAYERS.SIGNAL);
        renderer.draw();
    }

    document.getElementById('single_switch_show_signal_path').addEventListener('click', showSignalPath);
    document.getElementById('single_switch_show_wires').addEventListener('click', showWiredConnections);
    document.getElementById('single_switch_show_terminals').addEventListener('click', showTerminals);
    document.getElementById('single_switch_toggle_switch').addEventListener('click', toggle);

    canvas.addEventListener('mousemove', onMouseOver);
    canvas.addEventListener('click', toggle);
    window.addEventListener('resize', rescale);

    rescale();
    toggle();

    return renderer;
})();


return {
    singleSwitch: singleSwitch,
}

})();
