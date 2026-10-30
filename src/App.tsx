import { useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { jsPDF } from 'jspdf';

// Sample data pre-filled in textarea
const sampleData = {
  queries: [
    { query: "topic 1", seeds: [1, 6, 11], edges_strengthened: [[1, 2], [0, 1], [6, 7], [5, 6], [11, 12], [10, 11]] },
    { query: "topic 2", seeds: [2, 7, 12], edges_strengthened: [[2, 3], [1, 2], [7, 8], [6, 7], [12, 13], [11, 12]] },
    { query: "topic 3", seeds: [3, 8, 13], edges_strengthened: [[3, 4], [2, 3], [8, 9], [7, 8], [13, 14], [12, 13]] },
    { query: "topic 4", seeds: [4, 9, 14], edges_strengthened: [[4, 5], [3, 4], [9, 10], [8, 9], [14, 15], [13, 14]] },
    { query: "topic 0", seeds: [0, 5, 10], edges_strengthened: [[0, 1], [19, 0], [5, 6], [4, 5], [10, 11], [9, 10]] },
    { query: "topic 1", seeds: [1, 6, 11], edges_strengthened: [[1, 2], [0, 1], [6, 7], [5, 6], [11, 12], [10, 11]] },
    { query: "topic 2", seeds: [2, 7, 12], edges_strengthened: [[2, 3], [1, 2], [7, 8], [6, 7], [12, 13], [11, 12]] },
    { query: "topic 3", seeds: [3, 8, 13], edges_strengthened: [[3, 4], [2, 3], [8, 9], [7, 8], [13, 14], [12, 13]] },
    { query: "topic 1", seeds: [1, 6, 11], edges_strengthened: [[1, 2], [0, 1], [6, 7], [5, 6], [11, 12], [10, 11]] },
    { query: "topic 2", seeds: [2, 7, 12], edges_strengthened: [[2, 3], [1, 2], [7, 8], [6, 7], [12, 13], [11, 12]] }
  ],
  edges: [
    { source: 0, target: 1, weight: 1.3, access_count: 3 },
    { source: 1, target: 2, weight: 1.3, access_count: 3 },
    { source: 2, target: 3, weight: 1.3, access_count: 3 },
    { source: 3, target: 4, weight: 1.2, access_count: 2 },
    { source: 4, target: 5, weight: 1.2, access_count: 2 },
    { source: 5, target: 6, weight: 1.3, access_count: 3 },
    { source: 6, target: 7, weight: 1.3, access_count: 3 },
    { source: 7, target: 8, weight: 1.2, access_count: 2 },
    { source: 8, target: 9, weight: 1.2, access_count: 2 },
    { source: 9, target: 10, weight: 1.2, access_count: 2 },
    { source: 10, target: 11, weight: 1.3, access_count: 3 },
    { source: 11, target: 12, weight: 1.3, access_count: 3 },
    { source: 12, target: 13, weight: 1.2, access_count: 2 },
    { source: 13, target: 14, weight: 1.2, access_count: 2 },
    { source: 19, target: 0, weight: 1.1, access_count: 1 }
  ],
  summary: {
    total_edges_strengthened: 58,
    max_weight: 1.3,
    min_weight: 1.1,
    edges_accessed_more_than_once: 14
  }
};

interface EdgeData {
  source: number | string;
  target: number | string;
  weight: number;
  access_count: number;
}

interface QueryData {
  query: string;
  seeds: (number | string)[];
  edges_strengthened: number[][] | number;
}

interface SummaryData {
  total_edges_strengthened: number;
  max_weight: number;
  min_weight: number;
  edges_accessed_more_than_once: number;
}

interface GraphData {
  queries: QueryData[];
  edges: EdgeData[];
  summary: SummaryData;
}

interface SearchLogEntry {
  searchNumber: number;
  query: string;
  nodeFound: string;
  edgesStrengthened: number;
  newMaxWeight: number;
}

export default function App() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(sampleData, null, 2));
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [searchLog, setSearchLog] = useState<SearchLogEntry[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const nodesDataRef = useRef<any[]>([]);
  const linksDataRef = useRef<any[]>([]);
  const simulationRef = useRef<any>(null);
  const zoomBehaviorRef = useRef<any>(null);

  const normalizeNode = (n: number | string): string => {
    if (typeof n === 'number') return `n${n}`;
    if (typeof n === 'string' && !n.startsWith('n')) return `n${n}`;
    return String(n);
  };

  const visualize = useCallback(() => {
    setError(null);
    try {
      const data = JSON.parse(jsonInput);
      if (!data.queries || !data.edges || !data.summary) {
        throw new Error('JSON must contain "queries", "edges", and "summary" keys');
      }
      setGraphData(data);
      setSearchLog([]);
      setLastSearchQuery(null);
      setSearchNotFound(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [jsonInput]);

  // D3 Force Graph
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = 500;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform);
      });
    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    const zoomGroup = svg.append('g').attr('class', 'zoom-group');

    // Collect all unique nodes from edges
    const nodeSet = new Set<string>();
    graphData.edges.forEach(e => {
      nodeSet.add(normalizeNode(e.source));
      nodeSet.add(normalizeNode(e.target));
    });
    // Also add seed nodes from queries
    graphData.queries.forEach(q => {
      if (Array.isArray(q.seeds)) {
        q.seeds.forEach(s => nodeSet.add(normalizeNode(s)));
      }
    });

    const nodes = Array.from(nodeSet).map(id => ({ id }));
    const links = graphData.edges.map(e => ({
      source: normalizeNode(e.source),
      target: normalizeNode(e.target),
      weight: e.weight,
      access_count: e.access_count
    }));

    // Weight → color scale (1.0 = light gray, 1.3+ = red)
    const colorScale = d3.scaleLinear<string>()
      .domain([1.0, 1.3])
      .range(['#6b7280', '#ef4444'])
      .clamp(true);

    // Weight → stroke width scale
    const widthScale = d3.scaleLinear()
      .domain([1.0, 1.3])
      .range([1.5, 6])
      .clamp(true);

    // Store data in refs for search functionality
    nodesDataRef.current = nodes as any[];
    linksDataRef.current = links as any[];

    // Force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    simulationRef.current = simulation;

    // Links
    const link = zoomGroup.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'graph-link')
      .attr('stroke', (d: any) => colorScale(d.weight))
      .attr('stroke-width', (d: any) => widthScale(d.weight))
      .attr('stroke-opacity', 0.8)
      .style('cursor', 'pointer')
      .on('mouseover', function (event: MouseEvent, d: any) {
        d3.select(this).attr('stroke-opacity', 1).attr('stroke-width', widthScale(d.weight) + 2);
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = `${event.pageX + 10}px`;
          tooltipRef.current.style.top = `${event.pageY - 10}px`;
          const srcLabel = typeof d.source === 'object' ? d.source.id : d.source;
          const tgtLabel = typeof d.target === 'object' ? d.target.id : d.target;
          tooltipRef.current.innerHTML = `
            <div class="font-semibold text-white mb-1">Connection: ${srcLabel} ↔ ${tgtLabel}</div>
            <div class="text-gray-300">Strength (Weight): <span class="text-amber-400 font-bold">${d.weight.toFixed(2)}</span></div>
            <div class="text-gray-300">Times Recalled: <span class="text-green-400 font-bold">${d.access_count}</span></div>
          `;
        }
      })
      .on('mousemove', function (event: MouseEvent) {
        if (tooltipRef.current) {
          tooltipRef.current.style.left = `${event.pageX + 10}px`;
          tooltipRef.current.style.top = `${event.pageY - 10}px`;
        }
      })
      .on('mouseout', function (_event: MouseEvent, d: any) {
        d3.select(this).attr('stroke-opacity', 0.8).attr('stroke-width', widthScale(d.weight));
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'none';
        }
      });

    // Nodes
    const dragBehavior = d3.drag<SVGGElement, any>()
      .on('start', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event: any, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event: any, d: any) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const node = zoomGroup.append('g')
      .selectAll<SVGGElement, any>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .call(dragBehavior as any);

    node.append('circle')
      .attr('r', 18)
      .attr('fill', '#1e293b')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2);

    node.append('text')
      .text((d: any) => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#e2e8f0')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold');

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData]);

  // ── Search Logic ──────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    if (!svgRef.current || !graphData) return;
    const query = searchQuery.trim();
    if (!query) return;

    setSearchNotFound(false);
    setLastSearchQuery(query);

    const svg = d3.select(svgRef.current);
    const queryLower = query.toLowerCase();

    // Find matching node by ID or label (case-insensitive)
    const matchedNode = nodesDataRef.current.find((n: any) => {
      const id = String(n.id).toLowerCase();
      return id === queryLower || id === normalizeNode(query).toLowerCase();
    });

    if (!matchedNode) {
      setSearchNotFound(true);
      return;
    }

    const matchedId = matchedNode.id;

    // Find connected edges and neighbor node IDs
    const connectedEdgeIndices = new Set<number>();
    const neighborIds = new Set<string>();

    linksDataRef.current.forEach((link: any, i: number) => {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === matchedId || tgtId === matchedId) {
        connectedEdgeIndices.add(i);
        neighborIds.add(srcId === matchedId ? tgtId : srcId);
      }
    });

    // Highlight nodes
    svg.selectAll<SVGGElement, any>('.node-group')
      .each(function () {
        const g = d3.select(this);
        const circle = g.select('circle');
        const text = g.select('text');
        const nodeId = text.text();

        if (nodeId === matchedId) {
          // Matched node: yellow, larger
          circle
            .transition().duration(300)
            .attr('r', 28)
            .attr('fill', '#facc15')
            .attr('stroke', '#fbbf24')
            .attr('stroke-width', 4);
          text
            .transition().duration(300)
            .attr('fill', '#1e293b')
            .attr('font-size', '12px');
        } else if (neighborIds.has(nodeId)) {
          // Neighbor node: highlighted
          circle
            .transition().duration(300)
            .attr('r', 22)
            .attr('fill', '#f97316')
            .attr('stroke', '#fb923c')
            .attr('stroke-width', 3);
          text
            .transition().duration(300)
            .attr('fill', '#fff')
            .attr('font-size', '11px');
        } else {
          // Dim other nodes
          circle
            .transition().duration(300)
            .attr('r', 14)
            .attr('fill', '#1e293b')
            .attr('stroke', '#374151')
            .attr('stroke-width', 1);
          text
            .transition().duration(300)
            .attr('fill', '#6b7280')
            .attr('font-size', '9px');
        }
      });

    // Highlight edges
    svg.selectAll('.graph-link')
      .each(function (_d: any, i: number) {
        const line = d3.select(this);
        if (connectedEdgeIndices.has(i)) {
          line
            .transition().duration(300)
            .attr('stroke', '#f97316')
            .attr('stroke-width', 8)
            .attr('stroke-opacity', 1);
        } else {
          line
            .transition().duration(300)
            .attr('stroke', '#374151')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.3);
        }
      });

    // Compute new max weight from current edge data
    const currentMaxWeight = linksDataRef.current.reduce((max: number, l: any) => Math.max(max, l.weight || 0), 0);

    // Add to search log
    setSearchLog(prev => [
      ...prev,
      {
        searchNumber: prev.length + 1,
        query: query,
        nodeFound: matchedId,
        edgesStrengthened: connectedEdgeIndices.size,
        newMaxWeight: currentMaxWeight
      }
    ]);

    // Zoom/Pan to center on matched node
    if (matchedNode.x !== undefined && matchedNode.y !== undefined && zoomBehaviorRef.current) {
      const width = svgRef.current.clientWidth || 800;
      const height = 500;
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(1.5)
        .translate(-matchedNode.x, -matchedNode.y);

      svg.transition().duration(750)
        .call(zoomBehaviorRef.current.transform as any, transform);
    }
  }, [searchQuery, graphData, normalizeNode]);

  // ── Clear Search ──────────────────────────────────────────────────────────
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setLastSearchQuery(null);
    setSearchNotFound(false);

    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    // Reset color/width scales
    const colorScale = d3.scaleLinear<string>()
      .domain([1.0, 1.3])
      .range(['#6b7280', '#ef4444'])
      .clamp(true);
    const widthScale = d3.scaleLinear()
      .domain([1.0, 1.3])
      .range([1.5, 6])
      .clamp(true);

    // Reset nodes
    svg.selectAll<SVGGElement, any>('.node-group')
      .each(function () {
        const g = d3.select(this);
        g.select('circle')
          .transition().duration(300)
          .attr('r', 18)
          .attr('fill', '#1e293b')
          .attr('stroke', '#6366f1')
          .attr('stroke-width', 2);
        g.select('text')
          .transition().duration(300)
          .attr('fill', '#e2e8f0')
          .attr('font-size', '10px');
      });

    // Reset edges
    svg.selectAll('.graph-link')
      .each(function (d: any) {
        d3.select(this)
          .transition().duration(300)
          .attr('stroke', colorScale(d.weight))
          .attr('stroke-width', widthScale(d.weight))
          .attr('stroke-opacity', 0.8);
      });

    // Reset zoom
    const width = svgRef.current.clientWidth || 800;
    const height = 500;
    if (zoomBehaviorRef.current) {
      svg.transition().duration(500)
        .call(zoomBehaviorRef.current.transform as any, d3.zoomIdentity);
    }
    svg.attr('viewBox', `0 0 ${width} ${height}`);
  }, []);

  const downloadPDF = () => {
    if (!graphData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let yPos = 25;

    // Helper to add text with wrapping and page breaks
    const addWrappedText = (text: string, fontSize: number, color: [number, number, number], options?: { bold?: boolean; italic?: boolean; indent?: number }) => {
      doc.setFontSize(fontSize);
      doc.setTextColor(color[0], color[1], color[2]);
      const fontStyle = options?.bold ? 'bold' : options?.italic ? 'italic' : 'normal';
      doc.setFont('helvetica', fontStyle as any);
      const indent = options?.indent || 0;
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      lines.forEach((line: string) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, margin + indent, yPos);
        yPos += fontSize * 0.45;
      });
      yPos += 3;
    };

    const addSectionTitle = (title: string) => {
      if (yPos > pageHeight - 35) {
        doc.addPage();
        yPos = 20;
      }
      yPos += 5;
      doc.setDrawColor(99, 102, 241);
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(margin - 2, yPos - 5, contentWidth + 4, 10, 2, 2, 'F');
      doc.setFontSize(13);
      doc.setTextColor(67, 56, 202);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 2, yPos + 2);
      yPos += 12;
    };

    // ═══════════════════════════════════════════════════════════════
    // SECTION A: Title & Intro
    // ═══════════════════════════════════════════════════════════════
    doc.setFontSize(22);
    doc.setTextColor(67, 56, 202);
    doc.setFont('helvetica', 'bold');
    doc.text('AssociaDB', margin, yPos);
    yPos += 8;
    doc.setFontSize(14);
    doc.setTextColor(99, 102, 241);
    doc.text('Memory Testing Effect Report', margin, yPos);
    yPos += 4;
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    addWrappedText(
      'Is report me dikhaya gaya hai ki jab hum kisi cheez ko baar-baar yaad karte hain (Search karte hain), toh database kaise usko strong karta hai (Testing Effect). Ye ek simple concept hai: jitna zyada aap kisi memory ko recall karenge, utni hi strong wo connection ban jayegi.',
      10, [80, 80, 80]
    );
    yPos += 2;

    // ═══════════════════════════════════════════════════════════════
    // SECTION B: Initial Connections Kaise Bane?
    // ═══════════════════════════════════════════════════════════════
    addSectionTitle('SECTION B: Initial Connections Kaise Bane? (The Base Data)');

    const nodeSet = new Set<string>();
    graphData.edges.forEach(e => {
      nodeSet.add(normalizeNode(e.source));
      nodeSet.add(normalizeNode(e.target));
    });

    addWrappedText(
      `Shuru me humne ek real-world dataset load kiya tha (jaise Bollywood actors ka network). Jaise, Shahrukh Khan aur Kajol "Dilwale Dulhania Le Jayenge" movie se jude hain. Ye base connections hain jinki initial weight 1.0 thi.`,
      10, [80, 80, 80]
    );
    yPos += 2;

    addWrappedText(
      `Total Nodes (Entities): ${nodeSet.size}`,
      10, [60, 60, 60], { bold: true }
    );
    addWrappedText(
      `Total Edges (Connections): ${graphData.edges.length}`,
      10, [60, 60, 60], { bold: true }
    );
    addWrappedText(
      `Initial Weight of all connections: 1.0 (baseline)`,
      10, [60, 60, 60], { bold: true }
    );
    yPos += 4;

    // ═══════════════════════════════════════════════════════════════
    // SECTION C: Aapne Kya Search Kiya? (The Log)
    // ═══════════════════════════════════════════════════════════════
    addSectionTitle('SECTION C: Aapne Kya Search Kiya? (Search Log)');

    if (searchLog.length === 0) {
      addWrappedText(
        'Koi search nahi ki gayi. Aap UI me "Search" button use karke nodes dhundh sakte hain aur ye log fill hoga.',
        10, [150, 150, 150], { italic: true }
      );
    } else {
      // Table header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, yPos - 4, contentWidth, 7, 'F');
      doc.text('#', margin + 2, yPos);
      doc.text('Query Searched', margin + 12, yPos);
      doc.text('Node Found', margin + 65, yPos);
      doc.text('Edges Strengthened', margin + 100, yPos);
      doc.text('New Max Weight', margin + 145, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setDrawColor(229, 231, 235);

      searchLog.forEach((entry, i) => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        if (i % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, yPos - 4, contentWidth, 7, 'F');
        }
        doc.text(String(entry.searchNumber), margin + 2, yPos);
        doc.text(entry.query, margin + 12, yPos);
        doc.text(entry.nodeFound, margin + 65, yPos);
        doc.text(String(entry.edgesStrengthened), margin + 100, yPos);
        doc.text(entry.newMaxWeight.toFixed(2), margin + 145, yPos);
        doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
        yPos += 7;
      });
    }
    yPos += 6;

    // ═══════════════════════════════════════════════════════════════
    // SECTION D: Sabse Strong Connections (Top 5 Edges)
    // ═══════════════════════════════════════════════════════════════
    addSectionTitle('SECTION D: Sabse Strong Connections (Top 5)');

    const sortedEdges = [...graphData.edges].sort((a, b) => b.weight - a.weight);
    const top5 = sortedEdges.slice(0, 5);

    if (top5.length > 0) {
      top5.forEach((e, i) => {
        const srcNode = normalizeNode(e.source);
        const tgtNode = normalizeNode(e.target);
        const text = `${i + 1}. Connection between ${srcNode} and ${tgtNode} is very strong. It was accessed ${e.access_count} time(s) and its weight is now ${e.weight.toFixed(2)}.`;
        addWrappedText(text, 10, [60, 60, 60], { indent: 5 });
        yPos += 2;
      });
    } else {
      addWrappedText('Koi edge data nahi mila.', 10, [150, 150, 150]);
    }
    yPos += 4;

    // ═══════════════════════════════════════════════════════════════
    // SECTION E: Final Analysis (Layman)
    // ═══════════════════════════════════════════════════════════════
    addSectionTitle('SECTION E: Final Analysis (Layman Terms)');

    const totalSearches = searchLog.length;
    const queryFrequency: Record<string, number> = {};
    searchLog.forEach(entry => {
      queryFrequency[entry.query] = (queryFrequency[entry.query] || 0) + 1;
    });
    const mostFrequentQuery = Object.entries(queryFrequency).sort((a, b) => b[1] - a[1])[0];
    const mostFrequentQueryName = mostFrequentQuery ? mostFrequentQuery[0] : 'N/A';
    const mostFrequentQueryCount = mostFrequentQuery ? mostFrequentQuery[1] : 0;

    // Find the node most connected to the most-frequent query
    const mostConnectedNode = searchLog.length > 0
      ? searchLog.reduce((best, entry) => entry.edgesStrengthened > best.edgesStrengthened ? entry : best, searchLog[0]).nodeFound
      : 'N/A';

    const analysisText = `Analysis: Aapne total ${totalSearches} baar search kiya. Sabse zyada focus "${mostFrequentQueryName}" par tha (${mostFrequentQueryCount} baar search kiya). Isliye ${mostConnectedNode} ke connections sabse moti aur dark red lines ban gayi hain. Ye prove karta hai ki retrieval (search) se memory update hoti hai - jise hum "Testing Effect" kehte hain.`;

    addWrappedText(analysisText, 10, [55, 65, 81], { indent: 3 });
    yPos += 4;

    // Key stats summary box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(74, 222, 128);
    doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'FD');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Key Takeaways:', margin + 5, yPos + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(21, 128, 61);
    doc.text(`• Total searches performed: ${totalSearches}`, margin + 5, yPos + 14);
    doc.text(`• Max connection weight reached: ${graphData.summary.max_weight}`, margin + 5, yPos + 20);
    doc.text(`• Connections accessed more than once: ${graphData.summary.edges_accessed_more_than_once}`, margin + 5, yPos + 26);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated on: ${new Date().toLocaleString()} | AssociaDB Memory Testing Effect Report`, margin, pageHeight - 10);

    doc.save('associadb_report.pdf');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 hidden bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-xl pointer-events-none text-sm"
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Testing Effect Visualizer</h1>
              <p className="text-xs text-gray-400">Memory Graph Simulation Dashboard</p>
            </div>
          </div>
          {graphData && (
            <button
              onClick={downloadPDF}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF Report
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Explanation Box */}
        <section className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-700/50 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">💡</span>
            <div>
              <h3 className="text-sm font-bold text-indigo-300 mb-1">What is this?</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                This is a <span className="text-indigo-300 font-semibold">Memory Graph</span>. The initial connections (lines) are based on real-world data (e.g., Actors who worked in Movies). When you search for something, the system "remembers" it by making those lines <span className="text-yellow-300 font-semibold">thicker</span> and <span className="text-red-400 font-semibold">redder</span>. This is the <span className="text-emerald-400 font-semibold">"Testing Effect"</span> — the more you recall something, the stronger that memory becomes.
              </p>
            </div>
          </div>
        </section>

        {/* Live Search Section */}
        {graphData && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">🔍</span> Live Search / Manual Query
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  id="searchInput"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchNotFound(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="Search node by ID (e.g., n1, n5, n12)..."
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-yellow-500/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={handleClearSearch}
                className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Search
              </button>
            </div>
            {searchNotFound && (
              <div className="mt-3 bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
                ⚠️ Node not found in memory. Try: n0, n1, n2, ... n19
              </div>
            )}
            {lastSearchQuery && !searchNotFound && (
              <div className="mt-3 bg-yellow-900/20 border border-yellow-700/50 text-yellow-300 px-4 py-2 rounded-lg text-sm">
                🔎 Showing: <span className="font-bold">{lastSearchQuery}</span> — Node highlighted in yellow, neighbors in orange, connected edges emphasized.
              </div>
            )}
          </section>
        )}

        {/* JSON Input Section */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-xl">📋</span> Input JSON Data
            </h2>
            <button
              onClick={visualize}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/20"
            >
              ▶ Visualize
            </button>
          </div>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full h-48 bg-gray-950 border border-gray-700 rounded-lg p-4 font-mono text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
            spellCheck={false}
          />
          {error && (
            <div className="mt-3 bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}
        </section>

        {/* Graph Visualization */}
        {graphData && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">🕸️</span> Memory Graph
              <span className="ml-auto text-xs text-gray-400 font-normal">Drag nodes to rearrange • Hover edges for details</span>
            </h2>
            {/* Legend */}
            <div className="flex items-center gap-6 mb-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-gray-500 rounded"></div>
                <span>Weight 1.0</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1.5 bg-orange-500 rounded"></div>
                <span>Weight 1.15</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-2 bg-red-500 rounded"></div>
                <span>Weight 1.3+</span>
              </div>
            </div>
            <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
              <svg ref={svgRef} className="w-full" style={{ height: '500px' }} />
            </div>
          </section>
        )}

        {/* Query Table */}
        {graphData && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span> Query Results
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Query</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Seeds Found</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Edges Strengthened</th>
                  </tr>
                </thead>
                <tbody>
                  {graphData.queries.map((q, i) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                      <td className="py-3 px-4 text-white font-medium">{q.query}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(q.seeds) ? q.seeds : [q.seeds]).map((s, j) => (
                            <span key={j} className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono">
                              {normalizeNode(s)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded text-xs font-medium">
                          {Array.isArray(q.edges_strengthened) ? q.edges_strengthened.length : q.edges_strengthened} edges
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Live Search Log Table */}
        {graphData && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">📝</span> Live Search Log
              <span className="ml-auto text-xs text-gray-400 font-normal">
                {searchLog.length > 0 ? `${searchLog.length} search${searchLog.length > 1 ? 'es' : ''} recorded` : 'No searches yet'}
              </span>
            </h2>
            {searchLog.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-sm">Use the Search box above to find nodes. Each search will be logged here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Search #</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Query Searched</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Node Found</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Connections Strengthened</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">New Max Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchLog.map((entry, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-xs font-bold">
                            #{entry.searchNumber}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{entry.query}</td>
                        <td className="py-3 px-4">
                          <span className="bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded text-xs font-mono font-bold">
                            {entry.nodeFound}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-orange-900/50 text-orange-300 px-2 py-1 rounded text-xs font-medium">
                            {entry.edgesStrengthened} edges
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded text-xs font-bold">
                            {entry.newMaxWeight.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Summary Card */}
        {graphData && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">📈</span> Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Edges Strengthened</div>
                <div className="text-3xl font-bold text-indigo-400">{graphData.summary.total_edges_strengthened}</div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Max Weight</div>
                <div className="text-3xl font-bold text-red-400">{graphData.summary.max_weight}</div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Min Weight</div>
                <div className="text-3xl font-bold text-gray-400">{graphData.summary.min_weight}</div>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Edges Accessed &gt;1x</div>
                <div className="text-3xl font-bold text-emerald-400">{graphData.summary.edges_accessed_more_than_once}</div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6 text-center text-gray-500 text-sm">
        Testing Effect Memory Graph Visualizer • Built with D3.js & jsPDF
      </footer>
    </div>
  );
}
