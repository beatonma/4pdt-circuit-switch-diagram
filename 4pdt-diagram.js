const fourpdt = (() => {

    const EXTERNAL_CONNECTIONS = {
        FX_SEND: 'fx_send',
        FX_RETURN: 'fx_return',
        MAIN_IN: 'main_in',
        MAIN_OUT: 'main_out',
        RUBBERNECK_IN: 'rubberneck_in',
        RUBBERNECK_OUT: 'rubberneck_out',
    };

    const baseWidth = 800;
    const baseHeight = 600;

    const canvasWrapper = document.getElementById('fourpdt_diagram');
    const canvas = document.getElementById("fourpdt_diagram_canvas");
    const ctx = canvas.getContext("2d");

    const terminalRadius = 30;
    const terminalSpacing = terminalRadius * 4;
    const lineWidth = terminalRadius / 5;

    ctx.lineWidth = lineWidth;
    ctx.font = `${terminalRadius * .9}px Arial`;

    const externalConnectionColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
    const switchConnectionColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
    const green = getComputedStyle(document.documentElement).getPropertyValue('--green');
    const blue = getComputedStyle(document.documentElement).getPropertyValue('--blue');
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red');
    const grey = getComputedStyle(document.documentElement).getPropertyValue('--grey');

    var showLabels = true;

    class Terminal {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.temporaryConnections = [];
            this.permanentConnections = [];
            this.color = grey;
            this.externalConnection = null;
            this.label = '';
        }

        addTemporaryConnection(connection) {
            this.temporaryConnections.push(connection);
        }

        setPermanentConnections(connections) {
            this.permanentConnections = connections;
        }

        draw() {
            if (this.externalConnection) {
                this.drawExternalConnection();
            }

            ctx.beginPath();
            ctx.fillStyle = this.color;
            ctx.arc(this.x, this.y, terminalRadius, 0, 2 * Math.PI);
            ctx.fill();
        }

        drawExternalConnection() {
            ctx.beginPath();
            ctx.lineWidth = lineWidth * 2;
            ctx.strokeStyle = externalConnectionColor;
            ctx.arc(this.x, this.y, terminalRadius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.lineWidth = lineWidth;
        }
    }

    class FourPDTSwitch {
        constructor() {
            this.switchPosition = false;

            this.terminals = [];
            for (var i = 0; i < 12; i++) {
                this.terminals.push(
                    new Terminal(
                        (i % 4) * terminalSpacing + terminalSpacing,
                        Math.floor(i / 4) * terminalSpacing + terminalSpacing)
                    );
                this.terminals[i].label = '' + (i + 1);
            }

            this.setColor([0, 4, 9, 10], green);
            this.setColor([1, 2, 7, 11], blue);
            this.setColor([5, 6], red);

            // Green
            this.terminals[0].setPermanentConnections([9]);
            this.terminals[4].setPermanentConnections([10])

            // Blue
            this.terminals[1].setPermanentConnections([11]);
            this.terminals[2].setPermanentConnections([7])

            // External connections
            this.terminals[1].externalConnection = EXTERNAL_CONNECTIONS.MAIN_IN;
            this.terminals[2].externalConnection = EXTERNAL_CONNECTIONS.MAIN_OUT;

            this.terminals[9].externalConnection = EXTERNAL_CONNECTIONS.RUBBERNECK_IN;
            this.terminals[10].externalConnection = EXTERNAL_CONNECTIONS.RUBBERNECK_OUT;

            this.terminals[5].externalConnection = EXTERNAL_CONNECTIONS.FX_SEND;
            this.terminals[6].externalConnection = EXTERNAL_CONNECTIONS.FX_RETURN;
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

            this.draw();
        }

        setColor(terminalList, color) {
            for (var i = 0; i < terminalList.length; i++) {
                this.terminals[terminalList[i]].color = color;
            }
        }

        draw() {
            ctx.clearRect(0, 0, baseWidth, baseHeight);
            this.drawSwitchConnections();
            this.terminals.forEach(terminal => terminal.draw());
            this.drawConnections();

            if (showLabels) {
                this.terminals.forEach(terminal => {
                    const width = ctx.measureText(terminal.label);
                    ctx.beginPath();
                    ctx.fillText(terminal.label, terminal.x - width / 2, terminal.y);
                })
            }
        }

        addTemporaryConnection(first, second) {
            this.terminals[first].addTemporaryConnection(second);
            this.terminals[second].addTemporaryConnection(first);
        }

        drawConnections() {
            this.terminals.forEach(terminal => {
                const permanentConnections = terminal.permanentConnections;
                ctx.strokeStyle = terminal.color;
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
                    drawLine(terminal.x, terminal.y, other.x, other.y, switchConnectionColor);
                });
            });            
        }
    }

    function draw() {
        _switch.draw();
    }

    function showSignalPath() {
        // TODO
    }

    function drawLine(startX, startY, endX, endY, color) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    function toggle() {
        _switch.toggle();
    }

    const _switch = new FourPDTSwitch();
    toggle();

    document.getElementById('fourpdt_toggle').addEventListener('click', toggle);
    // draw();

    return {
        draw: draw,
        showLabels: showLabels,
        toggle: toggle,
    }
})();
