Project Motivation
I built Architect AI because I wanted to understand how Claude Code‑style tools work internally — and to see if I could build one myself.
I experimented with multiple strategies, refined retrieval logic, and tested the system across real codebases until it behaved reliably.

I enjoy finding tasks I can automate with AI and turning those ideas into working tools.


Architect AI is a fully local autonomous coding assistant inspired by tools like Claude Code.
I built it to understand how coding agents work internally — and to see if I could design one myself with lower token usage, safer edits, and predictable behavior.

The system uses:

Two‑agent workflow (Architect → Coder)

RAG with ChromaDB

Dynamic dependency graphs

Surgical Context retrieval

Strict prompting rules (no dead code, no unapproved imports)

I tested it across multiple real codebases to confirm reliability and correctness.



Key Features
🔍 Surgical Context Retrieval — Only loads the exact code needed

🗂️ File‑tree Mapping — Understands project structure

🧩 Dependency Graphs — Tracks relationships between files

🤖 Two‑Agent Workflow — Architect plans, Coder executes

🛡️ Safe Code Edits — No hallucinations, no broken imports

⚡ Low Token Usage — Designed to be efficient and local

🖥️ Full Stack Implementation — React + FastAPI
