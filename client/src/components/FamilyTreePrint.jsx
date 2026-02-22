import React from 'react';
import { User, Printer, X } from 'lucide-react';

const NODE_CIRCLE_SIZE = 90; // diameter in px

function getGraphBounds(nodes) {
    if (!nodes || nodes.length === 0) {
        return { width: 800, height: 600, minX: -400, minY: -300 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        if (node.x < minX) minX = node.x;
        if (node.x > maxX) maxX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.y > maxY) maxY = node.y;
    });
    const paddingX = 160;
    const paddingY = 140;
    return {
        minX: minX - paddingX,
        maxX: maxX + paddingX,
        minY: minY - paddingY,
        maxY: maxY + paddingY,
        width: (maxX - minX) + paddingX * 2,
        height: (maxY - minY) + paddingY * 2,
    };
}

function parseYear(dateStr) {
    if (!dateStr) return null;
    const year = new Date(dateStr).getFullYear();
    return Number.isNaN(year) ? null : year;
}

function getYearRange(node) {
    const birthYear = parseYear(node.birthDate);
    const deathYear = parseYear(node.deathDate);
    if (!birthYear) return '';
    return deathYear ? `${birthYear} – ${deathYear}` : `n. ${birthYear}`;
}

function FamilyTreePrint({ treeLayout, onClose }) {
    const nodes = treeLayout?.nodes || [];
    const edges = treeLayout?.edges || [];
    const bounds = getGraphBounds(nodes);

    const nodeMap = new Map(nodes.map(n => [n._id, n]));

    const renderEdges = () =>
        edges.map(edge => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;

            const fx = from.x - bounds.minX;
            const fy = from.y - bounds.minY;
            const tx = to.x - bounds.minX;
            const ty = to.y - bounds.minY;

            let pathD;
            let strokeColor = '#8B7355';
            let strokeWidth = '2';
            let strokeDasharray = '';

            if (edge.type === 'partner') {
                pathD = `M ${fx} ${fy} L ${tx} ${ty}`;
                strokeColor = '#B8860B';
                strokeWidth = '2.5';
            } else {
                const midY = (fy + ty) / 2;
                pathD = `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`;
                if (edge.parentalType === 'step') {
                    strokeDasharray = '6,4';
                } else if (edge.parentalType === 'adoptive') {
                    strokeDasharray = '3,3';
                } else if (edge.parentalType === 'foster') {
                    strokeDasharray = '8,4';
                }
            }

            return (
                <path
                    key={edge.id}
                    d={pathD}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    fill="none"
                />
            );
        });

    return (
        <div
            className="print-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                background: '#fdf6e3',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Toolbar — hidden when printing */}
            <div
                className="no-print"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1.5rem',
                    background: '#fff8e7',
                    borderBottom: '2px solid #d4a853',
                    flexShrink: 0,
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        color: '#7c5c3a',
                        fontFamily: 'Georgia, serif',
                        fontSize: '1.2rem',
                    }}
                >
                    🌳 Albero Genealogico — Vista Stampa
                </h2>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => window.print()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: '#7c5c3a',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        <Printer size={16} /> Stampa
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: '#e5e7eb',
                            color: '#374151',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        <X size={16} /> Chiudi
                    </button>
                </div>
            </div>

            {/* Tree canvas — scrollable on screen, expanded for print */}
            <div
                className="print-scroll-area"
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '2rem',
                    background: '#fdf6e3',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: bounds.width,
                        height: bounds.height,
                        margin: '0 auto',
                    }}
                >
                    {/* SVG edges */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            overflow: 'visible',
                        }}
                    >
                        {renderEdges()}
                    </svg>

                    {/* Person nodes */}
                    {nodes.map(node => {
                        const cx = node.x - bounds.minX;
                        const cy = node.y - bounds.minY;

                        if (node.kind === 'union') {
                            return (
                                <div
                                    key={node._id}
                                    style={{
                                        position: 'absolute',
                                        left: cx,
                                        top: cy,
                                        transform: 'translate(-50%, -50%)',
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#B8860B',
                                        border: '2px solid #fdf6e3',
                                    }}
                                />
                            );
                        }

                        const yearRange = getYearRange(node);

                        return (
                            <div
                                key={node._id}
                                style={{
                                    position: 'absolute',
                                    left: cx,
                                    top: cy,
                                    transform: 'translate(-50%, -50%)',
                                    textAlign: 'center',
                                    width: 130,
                                }}
                            >
                                {/* Circular photo */}
                                <div
                                    style={{
                                        width: NODE_CIRCLE_SIZE,
                                        height: NODE_CIRCLE_SIZE,
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '3px solid #B8860B',
                                        margin: '0 auto 6px',
                                        background: '#fff8e7',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(124, 92, 58, 0.25)',
                                    }}
                                >
                                    {node.photoUrl ? (
                                        <img
                                            src={node.photoUrl}
                                            alt={`${node.firstName} ${node.lastName}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <User size={36} color="#B8860B" />
                                    )}
                                </div>

                                {/* Name */}
                                <div
                                    style={{
                                        fontFamily: 'Georgia, serif',
                                        fontWeight: 'bold',
                                        fontSize: '0.8rem',
                                        color: '#3d2b1f',
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {node.firstName}
                                </div>
                                <div
                                    style={{
                                        fontFamily: 'Georgia, serif',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        color: '#3d2b1f',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {node.lastName}
                                </div>

                                {/* Years */}
                                {yearRange && (
                                    <div
                                        style={{
                                            fontFamily: 'Georgia, serif',
                                            fontSize: '0.65rem',
                                            color: '#7c5c3a',
                                            marginTop: 2,
                                        }}
                                    >
                                        {yearRange}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default FamilyTreePrint;
