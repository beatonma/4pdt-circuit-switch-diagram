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
    console.log(ctx.font);

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

        connect(connections) {
            this.temporaryConnections = connections;
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

            this.setColor([0, 4, 10, 11], green);
            this.setColor([2, 3, 5, 9], blue);
            this.setColor([6, 7], red);

            // Green
            this.terminals[0].setPermanentConnections([10]);
            this.terminals[4].setPermanentConnections([11])

            // Blue
            this.terminals[2].setPermanentConnections([9]);
            this.terminals[3].setPermanentConnections([5])

            // External connections
            this.terminals[2].externalConnection = EXTERNAL_CONNECTIONS.MAIN_IN;
            this.terminals[3].externalConnection = EXTERNAL_CONNECTIONS.MAIN_OUT;

            this.terminals[10].externalConnection = EXTERNAL_CONNECTIONS.RUBBERNECK_IN;
            this.terminals[11].externalConnection = EXTERNAL_CONNECTIONS.RUBBERNECK_OUT;

            this.terminals[6].externalConnection = EXTERNAL_CONNECTIONS.FX_SEND;
            this.terminals[7].externalConnection = EXTERNAL_CONNECTIONS.FX_RETURN;
        }

        toggle() {
            this.switchPosition = !this.switchPosition;
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
            const lineFunc = ((position) => {
                const terminal = this.terminals[position];
                const other = this.terminals[position + 4];

                drawLine(terminal.x, terminal.y, other.x, other.y, switchConnectionColor);
            });

            if (this.switchPosition) {
                [0, 1, 2, 3].forEach(lineFunc);
            }
            else {
                [4, 5, 6, 7].forEach(lineFunc);
            }
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
    draw();

    return {
        draw: draw,
        showLabels: showLabels,
        toggle: toggle,
    }
})();
