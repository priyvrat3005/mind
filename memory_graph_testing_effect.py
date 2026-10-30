# Google Colab Single-Cell Script: Simulate "Testing Effect" in a Memory Graph
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
print(json.dumps(result, indent=2))
