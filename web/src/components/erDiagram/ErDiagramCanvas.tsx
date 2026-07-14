import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import type {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2, KeyRound, Link2 } from "lucide-react";
import { EntityNode } from "./EntityNode";
import type { EntityNodeData } from "./EntityNode";
import { RelationshipEdge } from "./RelationshipEdge";
import type { RelationshipEdgeData } from "./RelationshipEdge";
import type { ErModel, ErAttribute, ErCardinality } from "../../types/erModel";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

const nodeTypes = { entity: EntityNode };
const edgeTypes = { relationship: RelationshipEdge };

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

function modelToFlow(model: ErModel): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = model.entities.map((entity, idx) => ({
    id: entity.id,
    type: "entity",
    position: entity.position ?? {
      x: 80 + (idx % 3) * 260,
      y: 80 + Math.floor(idx / 3) * 220,
    },
    data: {
      name: entity.name,
      attributes: entity.attributes,
    } as EntityNodeData,
  }));

  const edges: Edge[] = model.relationships.map((rel) => ({
    id: rel.id,
    source: rel.from,
    target: rel.to,
    type: "relationship",
    data: {
      cardinality: rel.cardinality,
      name: rel.name,
    } as RelationshipEdgeData,
  }));

  return { nodes, edges };
}

function flowToModel(nodes: Node[], edges: Edge[]): ErModel {
  return {
    entities: nodes.map((n) => {
      const data = n.data as unknown as EntityNodeData;
      return {
        id: n.id,
        name: data.name,
        attributes: data.attributes,
        position: n.position,
      };
    }),
    relationships: edges.map((e) => {
      const data = (e.data || {}) as RelationshipEdgeData;
      return {
        id: e.id,
        from: e.source,
        to: e.target,
        cardinality: data.cardinality || "1:N",
        name: data.name,
      };
    }),
  };
}

interface ErDiagramCanvasProps {
  initialValue: ErModel;
  onChange?: (model: ErModel) => void;
  readOnly?: boolean;
  className?: string;
}

/**
 * Componente controlado internamente: recebe `initialValue` só para
 * popular o estado inicial do React Flow (mudanças posteriores ao prop
 * NÃO resincronizam — se o consumidor precisa trocar de diagrama, deve
 * remontar com uma `key` diferente, ex: `key={submissionId}`, mesmo
 * padrão já usado em ClassroomView pro editor Monaco). Evita o loop de
 * sincronização bidirecional que travaria o React Flow a cada
 * `onChange`.
 */
export function ErDiagramCanvas({
  initialValue,
  onChange,
  readOnly = false,
  className,
}: ErDiagramCanvasProps) {
  const initial = useMemo(() => modelToFlow(initialValue), [initialValue]);
  const [nodes, setNodes] = useState<Node[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  const emitChange = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange?.(flowToModel(nextNodes, nextEdges));
    },
    [onChange],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        emitChange(next, edges);
        return next;
      });
    },
    [edges, emitChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        emitChange(nodes, next);
        return next;
      });
    },
    [nodes, emitChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => {
        const newEdge: Edge = {
          ...connection,
          id: nextId("rel"),
          type: "relationship",
          data: { cardinality: "1:N" } as RelationshipEdgeData,
        } as Edge;
        const next = addEdge(newEdge, eds);
        emitChange(nodes, next);
        return next;
      });
    },
    [readOnly, nodes, emitChange],
  );

  const handleAddEntity = () => {
    if (readOnly) return;
    const center = rfInstance?.screenToFlowPosition
      ? rfInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 3,
        })
      : { x: 100, y: 100 };

    const newNode: Node = {
      id: nextId("entity"),
      type: "entity",
      position: center,
      data: { name: "NovaEntidade", attributes: [] } as EntityNodeData,
    };
    const next = [...nodes, newNode];
    setNodes(next);
    setSelectedId(newNode.id);
    emitChange(next, edges);
  };

  const handleDeleteSelected = () => {
    if (readOnly || !selectedId) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedId);
    const nextEdges = edges.filter(
      (e) =>
        e.id !== selectedId &&
        e.source !== selectedId &&
        e.target !== selectedId,
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedId(null);
    emitChange(nextNodes, nextEdges);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const selectedEdge = edges.find((e) => e.id === selectedId);

  const updateSelectedNodeData = (patch: Partial<EntityNodeData>) => {
    const next = nodes.map((n) =>
      n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
    );
    setNodes(next);
    emitChange(next, edges);
  };

  const updateSelectedEdgeData = (patch: Partial<RelationshipEdgeData>) => {
    const next = edges.map((e) =>
      e.id === selectedId ? { ...e, data: { ...(e.data || {}), ...patch } } : e,
    );
    setEdges(next);
    emitChange(nodes, next);
  };

  return (
    <div className={cn("flex h-full w-full", className)}>
      <div className="flex-1 relative min-h-0 rounded-lg overflow-hidden border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          connectionMode={ConnectionMode.Loose}
          onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
            setSelectedId(selNodes[0]?.id ?? selEdges[0]?.id ?? null);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          fitView
          className="bg-background"
        >
          <Background gap={16} />
          <Controls showInteractive={!readOnly} />
          <MiniMap pannable zoomable className="!bg-surface" />
        </ReactFlow>

        {!readOnly && (
          <div className="absolute top-3 left-3 flex gap-2 z-10">
            <Button size="sm" onClick={handleAddEntity}>
              <Plus size={14} className="mr-1.5" /> Entidade
            </Button>
            {selectedId && (
              <Button size="sm" variant="danger" onClick={handleDeleteSelected}>
                <Trash2 size={14} className="mr-1.5" /> Remover
              </Button>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="w-72 flex-none border-l border-border bg-surface overflow-y-auto p-4">
          {selectedNode && (
            <EntityEditor
              data={selectedNode.data as unknown as EntityNodeData}
              onChange={updateSelectedNodeData}
            />
          )}
          {selectedEdge && (
            <RelationshipEditor
              data={(selectedEdge.data || {}) as RelationshipEdgeData}
              onChange={updateSelectedEdgeData}
            />
          )}
          {!selectedNode && !selectedEdge && (
            <p className="text-xs text-muted">
              Selecione uma entidade ou um relacionamento para editar. Para
              criar um relacionamento, arraste a partir da borda de uma entidade
              até outra.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EntityEditor({
  data,
  onChange,
}: {
  data: EntityNodeData;
  onChange: (patch: Partial<EntityNodeData>) => void;
}) {
  const updateAttribute = (idx: number, patch: Partial<ErAttribute>) => {
    const next = data.attributes.map((a, i) =>
      i === idx ? { ...a, ...patch } : a,
    );
    onChange({ attributes: next });
  };

  const addAttribute = () => {
    onChange({
      attributes: [...data.attributes, { name: "", isPK: false, isFK: false }],
    });
  };

  const removeAttribute = (idx: number) => {
    onChange({ attributes: data.attributes.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Nome da Entidade
        </label>
        <input
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Atributos
        </label>
        <button
          type="button"
          onClick={addAttribute}
          className="text-primary hover:text-primary/80"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {data.attributes.map((attr, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-1.5 p-2 rounded-md border border-border bg-background"
          >
            <div className="flex items-center gap-1.5">
              <input
                value={attr.name}
                onChange={(e) => updateAttribute(idx, { name: e.target.value })}
                placeholder="nome_atributo"
                className="flex-1 h-7 rounded border border-border bg-surface px-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => removeAttribute(idx)}
                className="text-muted hover:text-destructive"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attr.isPK}
                  onChange={(e) =>
                    updateAttribute(idx, { isPK: e.target.checked })
                  }
                />
                <KeyRound size={10} className="text-amber-500" /> PK
              </label>
              <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attr.isFK}
                  onChange={(e) =>
                    updateAttribute(idx, { isFK: e.target.checked })
                  }
                />
                <Link2 size={10} className="text-sky-500" /> FK
              </label>
              <input
                value={attr.type || ""}
                onChange={(e) => updateAttribute(idx, { type: e.target.value })}
                placeholder="tipo"
                className="flex-1 h-6 rounded border border-border bg-surface px-1 text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationshipEditor({
  data,
  onChange,
}: {
  data: RelationshipEdgeData;
  onChange: (patch: Partial<RelationshipEdgeData>) => void;
}) {
  const options: ErCardinality[] = ["1:1", "1:N", "N:M"];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Cardinalidade
        </label>
        <div className="mt-1.5 flex gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ cardinality: opt })}
              className={cn(
                "flex-1 h-9 rounded-md border text-xs font-mono font-bold transition-colors",
                data.cardinality === opt
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted uppercase tracking-wider">
          Nome (opcional)
        </label>
        <input
          value={data.name || ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="ex: possui"
          className="mt-1 w-full h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}
