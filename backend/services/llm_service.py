import os
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL") # Falls back to None if not set
)

def analyze_and_optimize(file_content: str) -> tuple[str, str]:
    prompt = """You are an expert software engineer. You will receive the full content of a source code file. 
    
    Task:
    1) Provide a brief summary of the main issues or opportunities for improvement (readability, performance, structure, security).
    2) Provide a fully optimized version of the file.
    
    Requirements:
    - Preserve the original functionality and public API.
    - Improve code clarity, structure, and performance where reasonable.
    - Follow best practices for the language and ecosystem.
    - Do NOT include external explanations outside the requested XML tags.
    
    CRITICAL FORMATTING: You must return your response exactly in this format:
    <summary>
    Your bullet points and summary here.
    </summary>
    <optimized_code>
    The actual raw code here, with no markdown code fences like ```python. Just the code.
    </optimized_code>
    """

    response = client.chat.completions.create(
        model="gpt-4o", # Can be changed to gpt-3.5-turbo or local models
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Here is the code:\n\n{file_content}"}
        ],
        temperature=0.2
    )

    result_text = response.choices[0].message.content

    # Parse out the summary and code using regex
    summary_match = re.search(r'<summary>(.*?)</summary>', result_text, re.DOTALL)
    code_match = re.search(r'<optimized_code>(.*?)</optimized_code>', result_text, re.DOTALL)

    summary = summary_match.group(1).strip() if summary_match else "No summary provided."
    code = code_match.group(1).strip() if code_match else file_content

    # Strip out accidental markdown backticks if the LLM ignores instructions
    if code.startswith("```"):
        code = "\n".join(code.split("\n")[1:])
    if code.endswith("```"):
        code = "\n".join(code.split("\n")[:-1])

    return summary, code.strip()
def generate_unit_tests(file_path: str, file_content: str) -> tuple[str, str, str]:
    prompt = f"""You are an expert QA and software engineer. You are writing unit tests for a file named `{file_path}`.
    
    Task:
    1) Provide a brief summary of the testing strategy and edge cases covered.
    2) Provide a complete, runnable unit test file using the standard testing framework for this language (e.g., PyTest for Python, Jest for JS/TS).
    3) Suggest the standard file name for this test file (e.g., `test_filename.py` or `filename.test.ts`).
    
    CRITICAL FORMATTING: Return your response exactly in this format:
    <summary>
    Your testing strategy here.
    </summary>
    <filename>
    suggested_test_filename_here
    </filename>
    <test_code>
    The actual raw test code here. No markdown fences.
    </test_code>
    """

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Here is the source code:\n\n{file_content}"}
        ],
        temperature=0.2
    )

    result_text = response.choices[0].message.content

    summary_match = re.search(r'<summary>(.*?)</summary>', result_text, re.DOTALL)
    filename_match = re.search(r'<filename>(.*?)</filename>', result_text, re.DOTALL)
    code_match = re.search(r'<test_code>(.*?)</test_code>', result_text, re.DOTALL)

    summary = summary_match.group(1).strip() if summary_match else "No summary provided."
    filename = filename_match.group(1).strip() if filename_match else "test_file"
    code = code_match.group(1).strip() if code_match else "No code generated."

    if code.startswith("```"):
        code = "\n".join(code.split("\n")[1:])
    if code.endswith("```"):
        code = "\n".join(code.split("\n")[:-1])

    # Ensure the suggested filename is in the same directory as the original file
    dir_name = os.path.dirname(file_path)
    full_suggested_filename = os.path.join(dir_name, filename).replace("\\", "/")

    return summary, code.strip(), full_suggested_filename