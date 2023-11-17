const switches = (() => {
    // External connections to jacks
    const Connection = {
        FxSend: "fx_send",
        FxReturn: "fx_return",
        MainIn: "main_in",
        MainOut: "main_out",
        RubberneckIn: "rubberneck_in", // Send from Rubberneck
        RubberneckOut: "rubberneck_out", // Return to Rubberneck
    };

    const About = {
        fx_send: "FX SEND: send signal to pedals in our effects loop.",
        fx_return: "FX RETURN: receive signal from pedals in our effects loop.",
        main_in: "Main IN: connected to pedals that come before the switch.",
        main_out: "Main OUT: connected to pedals that come after the switch.",
        rubberneck_in: "Rubberneck IN: receive signal from Rubberneck SEND.", // Send from Rubberneck
        rubberneck_out: "Rubberneck OUT: return signal to Rubberneck RETURN.", // Return to Rubberneck
    };

    const RenderLayers = {
        Terminals: "terminals",  // Show the terminals without any connections.
        ExternalWires: "external_wires", // Wires that go from the switch to an audio jack socket
        Switch: "switch", // Internal connections that are changed by toggling the switch.
        InternalWires: "internal_wires", // Wires you need to add to connect terminals of the switch.
        TerminalLabels: "terminal_labels", // Show reference numbers on terminals.
        ConnectionLabels: "connection_labels", // Show a list of terminals that a given terminal should be connected to
        Signal: "signal", // Show the signal path through the circuit for the current switch state
        Focussed: "focussed" // Highlight a terminal that has been interacted with
    };

    const Elements = {
        Canvas: document.getElementById("js_4pdt_canvas"),
        InfoLabel: document.getElementById("js_4pdt_label"),
        ToggleSwitch: document.getElementById("js_4pdt_toggle_switch"),
        ShowSignalPath: document.getElementById("js_4pdt_show_signal_path"),
        ShowWires: document.getElementById("js_4pdt_show_wires"),
        ShowTerminals: document.getElementById("js_4pdt_show_terminals"),
    }
    const canvas = document.getElementById("js_4pdt_canvas");

    const pairwise = list => {
        let output = [];
        for (let i = 0; i < list.length - 1; i++) {
            output.push([list[i], list[i + 1]]);
        }
        return output;
    };

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
                for (let id = 0; id < 12; id++) {
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
                } else {
                    [4, 5, 6, 7].forEach(position => {
                        this.addTemporaryConnection(position, position + 4);
                    });
                }

                this.updateSignalPaths();
            }

            updateSignalPaths() {
                const signalInputs = this.terminals.filter(terminal => [
                    Connection.MainIn, Connection.RubberneckIn,
                ].includes(terminal.externalConnection)).map(terminal => terminal.id);

                this.signalPaths = signalInputs.map(input => this.findSignalPath(input));
            }

            findSignalPath(startTerminal) {
                const _this = this;
                const signalOutputs = this.terminals.filter(terminal => [
                    Connection.MainOut, Connection.RubberneckOut,
                ].includes(terminal.externalConnection)).map(terminal => terminal.id);

                function findOutput(terminalId, visitedTerminals) {
                    if (visitedTerminals.has(terminalId)) {
                        return [];
                    }
                    visitedTerminals.add(terminalId);

                    const terminal = _this.terminals[terminalId];
                    const connections = terminal.temporaryConnections.concat(terminal.permanentConnections).filter((el) => !visitedTerminals.has(el));
                    let connected = [];
                    connections.forEach(c => {
                        if (signalOutputs.includes(c)) {
                            connected.push(c);
                        } else {
                            const cons = findOutput(c, visitedTerminals);
                            if (cons.length > 0) {
                                connected.push(c);
                                connected = connected.concat(cons);
                            }
                        }
                    });

                    const found = connected.some(r => signalOutputs.includes(r));
                    return found ? connected : [];
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

                let rewired = new Array(12);
                terminals.forEach(t => {
                    const originalId = t.id;
                    t.id = _offset(originalId);
                    t.permanentConnections = t.permanentConnections.map(connection => _offset(connection));
                    rewired[t.id] = t;
                });

                return rewired;
            }

            sw.terminals[10].externalConnection = Connection.MainIn;
            sw.terminals[11].externalConnection = Connection.MainOut;
            sw.addPermanentConnection(0, 10);
            sw.addPermanentConnection(4, 11);

            sw.terminals[2].externalConnection = Connection.RubberneckIn;
            sw.terminals[3].externalConnection = Connection.RubberneckOut;
            sw.addPermanentConnection(2, 9);
            sw.addPermanentConnection(3, 5);

            sw.terminals[6].externalConnection = Connection.FxSend;
            sw.terminals[7].externalConnection = Connection.FxReturn;
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

        const Colors = {
            Label: getCssVariable("--white"),
            ExternalConnection: getCssVariable("--white"),
            SwitchConnection: getCssVariable("--grey"),
            Grey: getCssVariable("--grey"),
            MainIO: getCssVariable("--green"),
            RubberneckIO: getCssVariable("--blue"),
            FxLoop: getCssVariable("--red"),
            Overlay: getCssVariable("--black"),
        };

        const TerminalColors = {
            "fx_send": Colors.FxLoop,
            "fx_return": Colors.FxLoop,
            "main_in": Colors.MainIO,
            "main_out": Colors.MainIO,
            "rubberneck_in": Colors.RubberneckIO,
            "rubberneck_out": Colors.RubberneckIO,
            "default": Colors.Grey,
        };

        let canvasWidth = 400;
        let canvasHeight = 320;
        let terminalSpacing = 1;
        let terminalRadius = 1;
        let lineWidth = 1;
        let arrowSize = 1;
        let fontSize = 1;

        const ctx = canvas.getContext("2d");

        function rescale() {
            canvasWidth = canvas.clientWidth;
            canvasHeight = canvasWidth * .75;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            terminalSpacing = canvasWidth / 4;
            terminalRadius = terminalSpacing / 4;
            lineWidth = terminalRadius / 5;
            arrowSize = lineWidth * 3;
            fontSize = terminalRadius;
            ctx.font = `${fontSize}px sans-serif`;
            ctx.lineWidth = lineWidth;
            ctx.lineJoin = "round";
            ctx.lineCap = "butt";
        }

        class TerminalRenderer {
            constructor(terminal, x, y) {
                this.terminal = terminal;
                this._x = x;
                this._y = y;
                this.color = Colors.Grey;
                this.focussed = false; // Mouse hovering over
                this.rescale();
            }

            rescale() {
                this.x = this.measuredX();
                this.y = this.measuredY();
            }

            measuredX() {
                return (this._x * terminalSpacing) + (terminalSpacing / 2);
            }

            measuredY() {
                return (this._y * terminalSpacing) + (terminalSpacing / 2);
            }
        }

        class FourPDTSwitchRenderer {
            constructor(fourpdtswitch) {
                this.renderLayers = [
                    RenderLayers.Terminals,
                    RenderLayers.ExternalWires,
                    RenderLayers.Switch,
                    RenderLayers.InternalWires,
                    RenderLayers.Signal,
                    RenderLayers.TerminalLabels,
                    RenderLayers.ConnectionLabels,
                    RenderLayers.Focussed,
                ];
                this.layerRenderers = [
                    [RenderLayers.Switch, this.drawSwitchConnections.bind(this)],
                    [RenderLayers.ExternalWires, this.drawConnectionConnections.bind(this)],
                    [RenderLayers.InternalWires, this.drawConnections.bind(this)],
                    [RenderLayers.Signal, this.drawSignal.bind(this)],
                    [RenderLayers.Terminals, this.drawTerminals.bind(this)],
                    [RenderLayers.TerminalLabels, this.drawTerminalLabels.bind(this)],
                    [RenderLayers.Focussed, this.drawFocus.bind(this)],
                ];

                this.switch = fourpdtswitch;
                this.terminals = this.switch.terminals.map(terminal => new TerminalRenderer(
                        terminal,
                        (terminal.id % 4),
                        Math.floor(terminal.id / 4)
                    )
                );
            }

            applyTerminalColors() {
                this.switch.terminals.forEach(terminal => {
                    if (terminal.externalConnection in TerminalColors) {
                        this.terminals[terminal.id].color = TerminalColors[terminal.externalConnection];
                    }
                });
            }

            rescale() {
                this.terminals.forEach(t => t.rescale());
            }

            draw() {
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);

                this.applyTerminalColors();
                if (this.shouldRender(RenderLayers.Signal) || this.shouldRender(RenderLayers.InternalWires)) {
                    this.switch.signalPaths.forEach(path => {
                        const first = path[0];
                        const color = TerminalColors[this.switch.terminals[first].externalConnection];

                        path.forEach(t => this.terminals[t].color = color);
                    });
                }

                this.layerRenderers.forEach(([layer, func]) => {
                    if (this.shouldRender(layer)) {
                        func();
                    }
                })


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
                        strokeCircle(renderer.x, renderer.y, terminalRadius, TerminalColors[renderer.terminal.externalConnection]);
                        ctx.lineWidth = lineWidth;
                        ctx.restore();
                    }

                    fillCircle(renderer.x, renderer.y, terminalRadius, renderer.color);
                });
            }

            drawConnections() {
                if (this.renderLayers.includes(RenderLayers.Signal)) {
                    // Fade wired connections to make signals stand out more.
                    ctx.save();
                    ctx.globalAlpha = .1;
                }
                this.terminals.forEach(renderer => {
                    // Don"t render line that goes through fx loop.
                    if ([
                        Connection.FxSend,
                        Connection.FxReturn,
                    ].includes(renderer.terminal.externalConnection)) {
                        return;
                    }

                    const permanentConnections = renderer.terminal.permanentConnections;
                    permanentConnections.forEach(connection => {
                        const other = this.terminals[connection];
                        drawLine(...indentLine(renderer.x, renderer.y, other.x, other.y), renderer.color);
                    });
                });
                if (this.renderLayers.includes(RenderLayers.Signal)) {
                    ctx.restore();
                    ctx.globalAlpha = 1;
                }
            }

            drawSwitchConnections() {
                this.terminals.forEach(renderer => {
                    renderer.terminal.temporaryConnections.forEach(connection => {
                        const other = this.terminals[connection];
                        drawLine(...indentLine(renderer.x, renderer.y, other.x, other.y), Colors.SwitchConnection);
                    });
                });
            }

            drawTerminalLabels() {
                this.terminals.forEach(renderer => {
                    const metrics = ctx.measureText(renderer.terminal.label);
                    const left = renderer.x - (metrics.width / 2);
                    const baseline = renderer.y + (fontSize / 3);

                    ctx.strokeStyle = Colors.Overlay;
                    ctx.strokeText(renderer.terminal.label, left, baseline);

                    ctx.fillStyle = Colors.Label;
                    ctx.fillText(renderer.terminal.label, left, baseline);
                });
            }

            drawFocus() {
                this.terminals.forEach(renderer => {
                    if (!renderer.focussed) return;

                    ctx.lineWidth = lineWidth / 2;
                    strokeCircle(renderer.x, renderer.y, terminalRadius, Colors.Label);
                    ctx.lineWidth = lineWidth;
                })
            }

            drawConnectionConnections() {
                this.terminals.forEach(renderer => {
                    const ext = renderer.terminal.externalConnection;
                    switch (ext) {
                        case null:
                            break;
                        case Connection.RubberneckIn:
                        case Connection.MainIn:
                        case Connection.FxSend:
                            drawArrowWithOutline(...indentLine(renderer.x - terminalRadius, renderer.y, renderer.x - terminalRadius * 2, renderer.y + terminalRadius), Colors.ExternalConnection);
                            break;
                        case Connection.RubberneckOut:
                        case Connection.MainOut:
                        case Connection.FxReturn:
                            drawArrowWithOutline(...indentLine(renderer.x + terminalRadius * 2, renderer.y + terminalRadius, renderer.x + terminalRadius, renderer.y), Colors.ExternalConnection);
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
                const info = [];
                if (terminal.externalConnection != null) {
                    info.push(`${About[terminal.externalConnection]}`);
                }

                const connections = terminal.permanentConnections.map(c => this.terminals[c].terminal.label);
                if (connections.length > 0) {
                    info.push(`Wired connection to ${connections.join(", ")}.`);
                } else {
                    info.push(`No wired connections.`);
                }
                const listContent = info.join("</li><li>");
                Elements.InfoLabel.innerHTML = `<h3>Terminal ${terminal.label}</h3><ul><li>${listContent}</li></ul>`;
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
            const subLine = indentLine(startX, startY, endX, endY, 0, arrowSize / 2);
            ctx.beginPath();
            ctx.moveTo(subLine[0], subLine[1]);
            ctx.lineTo(subLine[2], subLine[3]);
            ctx.fillStyle = ctx.strokeStyle = Colors.Overlay;
            ctx.lineWidth = lineWidth * 2;
            ctx.stroke();

            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            plotArrowHead(startX, startY, endX, endY);
            ctx.strokeStyle = Colors.Overlay;
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
            return Math.atan2(dy, dx);
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
            Elements.ToggleSwitch.value = singleSwitch.switchPosition;
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
                renderer.renderLayers = renderer.renderLayers.filter(item => item !== layer);
            } else {
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
                renderer.renderLayers = renderer.renderLayers.filter(item => item !== layer);
            }
        }

        function showSignalPath() {
            showLayer(RenderLayers.Signal);
            showLayer(RenderLayers.InternalWires);
            showLayer(RenderLayers.Switch);
            renderer.draw();
        }

        function showWiredConnections() {
            showLayer(RenderLayers.InternalWires);
            showLayer(RenderLayers.Switch);
            hideLayer(RenderLayers.Signal);
            renderer.draw();
        }

        function showTerminals() {
            hideLayer(RenderLayers.InternalWires);
            hideLayer(RenderLayers.Switch);
            hideLayer(RenderLayers.Signal);
            renderer.draw();
        }

        Elements.ShowSignalPath.addEventListener("click", showSignalPath);
        Elements.ShowWires.addEventListener("click", showWiredConnections);
        Elements.ShowTerminals.addEventListener("click", showTerminals);
        Elements.ToggleSwitch.addEventListener("click", toggle);

        canvas.addEventListener("mousemove", onMouseOver);
        window.addEventListener("resize", rescale);

        rescale();
        toggle();

        return renderer;
    })();

    return {
        singleSwitch: singleSwitch,
    }
})();
