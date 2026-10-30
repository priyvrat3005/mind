import { useState } from 'react';

const pythonCode = `# Google Colab Single-Cell Script: Simulate "Testing Effect" in a Memory Graph
# Copy-paste this entire block into a single Colab cell and run.

!pip install networkx sentence-transformers numpy -q

import networkx as nx
import numpy as np
import json
from sentence_transformers import SentenceTransformer

# ── Step 3: Create graph of 20 nodes ──────────────────────────────────────────
G = nx.Graph()
for i in range(20):
    G.add_node(i, text=f"Memory {i} about topic {i % 5}")

# ── Step 4: Edges between consecutive nodes (circular) ───────────────────────
for i in range(20):
    neighbor = (i + 1) % 20
    G.add_edge(i, neighbor, weight=1.0, access_count=0)

# ── Step 5: Embed all node texts ─────────────────────────────────────────────
model = SentenceTransformer('all-MiniLM-L6-v2')
node_texts = [G.nodes[i]['text'] for i in range(20)]
node_embeddings = model.encode(node_texts)

# ── Step 6: retrieve_and_write function ──────────────────────────────────────
def retrieve_and_write(query, top_k=3, write_budget=0.1):
    # Embed query
    query_embedding = model.encode([query])[0]

    # Cosine similarity with all nodes
    similarities = np.dot(node_embeddings, query_embedding) / (
        np.linalg.norm(node_embeddings, axis=1) * np.linalg.norm(query_embedding)
    )

    # Top-k seeds
    top_k_indices = np.argsort(similarities)[::-1][:top_k]
    seeds = list(top_k_indices)

    # 1-hop neighbors of seeds
    activated_edges = []
    for seed in seeds:
        neighbors = list(G.neighbors(seed))
        for neighbor in neighbors:
            edge = tuple(sorted((seed, neighbor)))
            if edge not in activated_edges:
                activated_edges.append(edge)

    # Strengthen activated edges
    for u, v in activated_edges:
        G[u][v]['weight'] = min(G[u][v]['weight'] + write_budget, 1.0)
        G[u][v]['access_count'] += 1

    return seeds, activated_edges

# ── Step 7: Run 10 queries ───────────────────────────────────────────────────
queries = [
    "topic 1", "topic 2", "topic 3", "topic 4", "topic 0",
    "topic 1", "topic 2", "topic 3", "topic 1", "topic 2"
]

# ── Step 8: Track results for each query ─────────────────────────────────────
query_results = []
total_edges_strengthened = 0

for query in queries:
    seeds, activated_edges = retrieve_and_write(query, top_k=3, write_budget=0.1)
    total_edges_strengthened += len(activated_edges)
    query_results.append({
        "query": query,
        "seeds": [int(s) for s in seeds],
        "edges_strengthened": [[int(u), int(v)] for u, v in activated_edges]
    })

# ── Step 9: Build final JSON result ──────────────────────────────────────────
# Edges with access_count > 0
accessed_edges = []
for u, v in G.edges():
    if G[u][v]['access_count'] > 0:
        accessed_edges.append({
            "source": int(u),
            "target": int(v),
            "weight": round(G[u][v]['weight'], 4),
            "access_count": G[u][v]['access_count']
        })

# Summary stats
weights = [e['weight'] for e in accessed_edges]
edges_accessed_more_than_once = sum(1 for e in accessed_edges if e['access_count'] > 1)

result = {
    "queries": query_results,
    "edges": accessed_edges,
    "summary": {
        "total_edges_strengthened": total_edges_strengthened,
        "max_weight": round(max(weights), 4) if weights else 0,
        "min_weight": round(min(weights), 4) if weights else 0,
        "edges_accessed_more_than_once": edges_accessed_more_than_once
    }
}

# ── Step 10: Print JSON ─────────────────────────────────────────────────────
print(json.dumps(result, indent=2))`;

function highlightPython(code: string) {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    let highlighted = line;
    // Comments
    highlighted = highlighted.replace(/(#.*)$/gm, '<span class="text-green-400">$1</span>');
    // Strings (double-quoted)
    highlighted = highlighted.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="text-amber-300">$1</span>');
    // Strings (single-quoted)
    highlighted = highlighted.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="text-amber-300">$1</span>');
    // Keywords
    highlighted = highlighted.replace(/\b(def|import|from|for|in|if|return|list|range|tuple|sorted|min|max|sum|round|int|print)\b/g, '<span class="text-purple-400 font-semibold">$1</span>');
    // Shell commands
    if (line.trim().startsWith('!')) {
      highlighted = '<span class="text-cyan-400">' + line + '</span>';
    }
    return `<span class="text-gray-500 select-none mr-4 inline-block w-8 text-right">${i + 1}</span>${highlighted}`;
  }).join('\n');
}

export default function App() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pythonCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">Testing Effect Simulation</h1>
              <p className="text-xs text-gray-400">Memory Graph · Google Colab Script</p>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {copied ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Code
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Info Section */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-purple-400 text-sm font-medium mb-1">📊 Graph</div>
            <div className="text-2xl font-bold">20 nodes</div>
            <div className="text-gray-400 text-xs">Circular topology, 5 topics</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-blue-400 text-sm font-medium mb-1">🔍 Queries</div>
            <div className="text-2xl font-bold">10 runs</div>
            <div className="text-gray-400 text-xs">With repeated retrieval</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-green-400 text-sm font-medium mb-1">✍️ Write Budget</div>
            <div className="text-2xl font-bold">0.1 / edge</div>
            <div className="text-gray-400 text-xs">Strengthens accessed paths</div>
          </div>
        </div>

        {/* Code Block */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-3 text-sm text-gray-400 font-mono">memory_graph_testing_effect.py</span>
            </div>
            <span className="text-xs text-gray-500">Single Colab Cell</span>
          </div>
          <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono">
            <code dangerouslySetInnerHTML={{ __html: highlightPython(pythonCode) }} />
          </pre>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-2xl">🚀</span> How to Run
          </h2>
          <ol className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <span>Open <a href="https://colab.research.google.com" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Google Colab</a> and create a new notebook.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <span>Click the <strong>"Copy Code"</strong> button above to copy the entire script.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <span>Paste into a single cell and press <kbd className="bg-gray-800 px-2 py-0.5 rounded text-xs border border-gray-700">Shift+Enter</kbd> to run.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
              <span>The cell will install dependencies, build the memory graph, run queries, and output JSON results.</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
