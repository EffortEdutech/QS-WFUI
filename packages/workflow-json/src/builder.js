"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowBuilder = void 0;
const constants_1 = require("./constants");
class WorkflowBuilder {
    name;
    id;
    version;
    nodes = [];
    connections = [];
    constructor(name, id, version = '1.0.0') {
        this.name = name;
        this.id = id;
        this.version = version;
    }
    addNode(node) {
        this.nodes.push(node);
        return this;
    }
    addConnection(conn) {
        this.connections.push(conn);
        return this;
    }
    build() {
        const now = new Date().toISOString();
        return {
            schemaVersion: constants_1.WORKFLOW_SCHEMA_VERSION,
            workflow: {
                id: this.id,
                name: this.name,
                version: this.version,
                status: 'draft',
                createdAt: now,
                updatedAt: now,
            },
            nodes: this.nodes,
            connections: this.connections,
        };
    }
    static blank(name, id) {
        return new WorkflowBuilder(name, id)
            .addNode({
            id: 'node-start',
            type: 'core.start',
            label: 'Start',
            position: { x: 100, y: 200 },
            config: {},
        })
            .addNode({
            id: 'node-end',
            type: 'core.end',
            label: 'End',
            position: { x: 500, y: 200 },
            config: {},
        })
            .build();
    }
}
exports.WorkflowBuilder = WorkflowBuilder;
//# sourceMappingURL=builder.js.map