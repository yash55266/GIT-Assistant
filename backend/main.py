from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.llm_service import analyze_and_optimize, generate_unit_tests
import logging
from services import llm_service
from models import TestGenerationResponse # Add this to your imports at the top

from models import ConnectRepoRequest, RepoResponse, AnalyzeRequest, AnalyzeResponse, CommitRequest, CommitResponse
from services.git_service import git_service
from services.llm_service import analyze_and_optimize

app = FastAPI(title="AI Git Assistant API")

# Setup CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/repo/connect", response_model=RepoResponse)
def connect_repo(req: ConnectRepoRequest):
    try:
        repo_info = git_service.connect(req.path_or_url)
        return repo_info
    except Exception as e:
        logging.error(f"Error connecting to repo: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_file(req: AnalyzeRequest):
    try:
        original_code = git_service.read_file(req.file_path)
        summary, optimized_code = analyze_and_optimize(original_code)
        
        return AnalyzeResponse(
            summary=summary,
            original_code=original_code,
            optimized_code=optimized_code
        )
    except Exception as e:
        logging.error(f"Error analyzing file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/repo/commit", response_model=CommitResponse)
def commit_changes(req: CommitRequest):
    try:
        msg = req.commit_message or f"AI Optimization: Refactored {req.file_path}"
        branch_name = git_service.create_branch_and_commit(req.file_path, req.optimized_code, msg)
        return CommitResponse(
            success=True,
            branch_name=branch_name,
            message=f"Changes successfully committed to {branch_name}"
        )
    except Exception as e:
        logging.error(f"Error committing changes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-tests", response_model=TestGenerationResponse)
def generate_tests(req: AnalyzeRequest):
    try:
        original_code = git_service.read_file(req.file_path)
        # Call the function directly without 'llm_service.'
        summary, test_code, suggested_filename = generate_unit_tests(req.file_path, original_code)
        
        return TestGenerationResponse(
            summary=summary,
            test_code=test_code,
            suggested_filename=suggested_filename
        )
    except Exception as e:
        logging.error(f"Error generating tests: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/repo/dependencies")
def get_dependencies():
    try:
        return git_service.get_dependency_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/intent-search")
def intent_search(req: dict): # Simple dict for { "query": "..." }
    query = req.get("query")
    candidates = git_service.search_code_for_keywords(query)
    
    if not candidates:
        raise HTTPException(status_code=404, detail="No matching code found.")
        
    result = llm_service.locate_intent(query, candidates)
    return {"result": result}