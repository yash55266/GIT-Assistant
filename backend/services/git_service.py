import os
import shutil
from git import Repo
import uuid
from datetime import datetime
import re

WORKSPACE_DIR = os.path.join(os.getcwd(), "workspace")

IGNORED_DIRS = {".git", "node_modules", "venv", ".venv", "dist", "build", "__pycache__"}
ALLOWED_EXTENSIONS = {".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".cs", ".go", ".rs", ".cpp", ".c", ".h"}

class GitService:
    def __init__(self):
        self.current_repo: Repo = None
        self.repo_path: str = None
        if not os.path.exists(WORKSPACE_DIR):
            os.makedirs(WORKSPACE_DIR)

    def connect(self, path_or_url: str) -> dict:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://") or path_or_url.startswith("git@"):
            # It's a remote URL, clone it
            repo_name = path_or_url.split("/")[-1].replace(".git", "") + "_" + str(uuid.uuid4())[:6]
            self.repo_path = os.path.join(WORKSPACE_DIR, repo_name)
            self.current_repo = Repo.clone_from(path_or_url, self.repo_path)
        else:
            # It's a local path
            if not os.path.exists(path_or_url):
                raise ValueError("Local path does not exist.")
            self.repo_path = os.path.abspath(path_or_url)
            self.current_repo = Repo(self.repo_path)

        return {
            "name": os.path.basename(self.repo_path),
            "active_branch": self.current_repo.active_branch.name,
            "files": self.get_code_files()
        }

    def get_code_files(self):
        code_files = []
        for root, dirs, files in os.walk(self.repo_path):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in ALLOWED_EXTENSIONS:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.repo_path)
                    code_files.append(rel_path)
        return sorted(code_files)

    def read_file(self, file_path: str) -> str:
        full_path = os.path.join(self.repo_path, file_path)
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def get_dependency_graph(self):
        if not self.repo_path:
            return {"nodes": [], "edges": []}
            
        files = self.get_code_files()
        edges = []
        
        for file in files:
            try:
                content = self.read_file(file)
                # Find JavaScript/TypeScript imports (e.g., import {x} from './utils')
                js_imports = re.findall(r'from\s+[\'"](?:\.\/|\.\.\/)([^\'"]+)[\'"]', content)
                for imp in js_imports:
                    imp_name = imp.split('/')[-1]
                    for target in files:
                        if target != file and imp_name in target:
                            edges.append({"id": f"{file}-{target}", "source": file, "target": target})
                            
                # Find Python imports (e.g., from utils import x)
                py_imports = re.findall(r'(?:from|import)\s+([a-zA-Z0-9_\.]+)', content)
                for imp in py_imports:
                    imp_name = imp.split('.')[-1]
                    for target in files:
                        if target != file and target.endswith(f"{imp_name}.py"):
                            edges.append({"id": f"{file}-{target}", "source": file, "target": target})
            except Exception:
                pass # Skip files we can't parse

        nodes = [{"id": f, "label": f.split('/')[-1]} for f in files]
        return {"nodes": nodes, "edges": edges}

    def create_branch_and_commit(self, file_path: str, optimized_code: str, commit_message: str):
        if not self.current_repo:
            raise ValueError("No repository connected.")

        timestamp = datetime.now().strftime("%Y%md_%H%M%S")
        branch_name = f"ai-optimization/{timestamp}"
        
        # Create and checkout new branch
        new_branch = self.current_repo.create_head(branch_name)
        new_branch.checkout()

        # Write optimized code to file
        full_path = os.path.join(self.repo_path, file_path)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(optimized_code)

        # Stage and commit
        self.current_repo.index.add([file_path])
        self.current_repo.index.commit(commit_message)

        # NEW CODE: Push the new branch to the remote repository (GitHub)
        try:
            origin = self.current_repo.remote(name='origin')
            origin.push(refspec=f'{branch_name}:{branch_name}')
        except Exception as e:
            # If pushing fails (usually due to auth), we still return the branch name
            # but append a warning so the user knows it's only local.
            return f"{branch_name} (Local only - Push failed: {str(e)})"

        return branch_name

git_service = GitService()