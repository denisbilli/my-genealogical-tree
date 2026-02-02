import React, { memo } from 'react';
import { User, Plus, Trash2 } from 'lucide-react';

// Memoized NodeCard Component
const NodeCard = memo(({ 
    node, 
    onAddParent, 
    onAddPartner, 
    onAddSibling, 
    onAddChild, 
    onEdit, 
    onDelete 
}) => {
    console.log("Rendering Node:", node._id, node.firstName, node.x, node.y);
    // We map 'node' which comes from layout back to 'person' structure
    // actually layout node contains all person fields.
    const isUnion = node.kind === 'union';

    if (isUnion) {
        // Render a small dot or heart for union
        return (
            <div 
                style={{ 
                    position: 'absolute', 
                    left: node.x, 
                    top: node.y,
                    transform: 'translate(-50%, -50%)',
                    width: 14, height: 14, 
                    borderRadius: '50%', 
                    backgroundColor: '#fda4af', // pink-300
                    border: '2px solid white',
                    zIndex: 5,
                    boxShadow: '0 0 0 1px #e5e7eb'
                }}
                title="Unione"
            />
        );
    }

    // Safety check for date
    let yearRange = '? - Presente';
    try {
        const birthYear = node.birthDate ? new Date(node.birthDate).getFullYear() : '?';
        const deathYear = node.deathDate ? new Date(node.deathDate).getFullYear() : 'Presente';
        yearRange = `${Number.isNaN(birthYear) ? '?' : birthYear} - ${Number.isNaN(deathYear) && deathYear !== 'Presente' ? '?' : deathYear}`;
    } catch(e) {
        // fallback
    }

    return (
        <div 
            className="node-card" 
            style={{ 
                position: 'absolute', 
                left: node.x, 
                top: node.y,
                transform: 'translate(-50%, -50%)', // Center on coordinate
                margin: 0, // Reset margin from CSS class
                border: node.isPartner ? '2px solid #fca5a5' : undefined,
                width: 250, // Fixed width
                height: 100 // Fixed height
            }}
        >
            {/* Add Parent Button */}
            <button className="btn-add-parent" onClick={(e) => { e.stopPropagation(); onAddParent(node); }} title="Aggiungi Genitore">
                <Plus size={14} />
            </button>

            {/* Add Partner Button */}
            <button className="btn-add-partner" onClick={(e) => { e.stopPropagation(); onAddPartner(node); }} title="Aggiungi Partner">
                <Plus size={14} />
            </button>

            {/* Add Sibling Button */}
            <button className="btn-add-sibling" onClick={(e) => { e.stopPropagation(); onAddSibling(node); }} title="Aggiungi Fratello">
                <Plus size={14} />
            </button>

            <div className="flex items-center gap-3 w-full h-full p-2">
                <div className="node-image-wrapper flex-shrink-0">
                    {node.photoUrl ? (
                        <img 
                            src={node.photoUrl} 
                            alt={node.firstName} 
                            className="node-image" 
                            onError={(e) => { e.target.onerror = null; e.target.src = '' /* fallback? */; }}
                        />
                    ) : (
                        <User size={24} />
                    )}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <h3 style={{ fontWeight: 'bold', margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.firstName} <span style={{ textTransform: 'uppercase', fontSize: '0.8rem', opacity: 0.7 }}>{node.lastName}</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#666' }}>
                         {yearRange}
                    </p>
                </div>
                <div className="flex flex-col gap-1">
                     <button onClick={() => onEdit(node)} className="text-gray-400 hover:text-blue-500" title="Modifica">
                        <User size={14} />
                    </button>
                    <button onClick={() => onDelete(node._id)} className="text-gray-400 hover:text-red-500" title="Elimina">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Add Child Button */}
            <button className="btn-add-child" onClick={(e) => { e.stopPropagation(); onAddChild(node); }} title="Aggiungi Figlio">
                <Plus size={14} />
            </button>
        </div>
    );
});

export default NodeCard;
