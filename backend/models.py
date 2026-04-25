from pydantic import BaseModel
from typing import List, Optional

class ConnectRepoRequest(BaseModel):
    path_or_url: str

class RepoResponse(BaseModel):
    name: str
    active_branch: str
    files: List[str]

class AnalyzeRequest(BaseModel):
    file_path: str

class AnalyzeResponse(BaseModel):
    summary: str
    original_code: str
    optimized_code: str

class CommitRequest(BaseModel):
    file_path: str
    optimized_code: str
    commit_message: Optional[str] = None

class CommitResponse(BaseModel):
    success: bool
    branch_name: str
    message: str

class TestGenerationResponse(BaseModel):
    summary: str
    test_code: str
    suggested_filename: str