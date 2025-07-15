import os
import argparse

def find_non_utf8_filenames(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            full_path = os.path.join(root, file)  # Get full path
            
            try:
                full_path.encode('utf-8')  # Try encoding as UTF-8
            except UnicodeEncodeError as e:
                # Extract the problematic character
                problem_char = full_path[e.start:e.end]
                print(f"⚠️ Non-UTF-8 character found in: {full_path}")
                print(f"   Problematic character: {repr(problem_char)}\n")
    print("✅ Scan complete.")

    for root, _, files in os.walk(directory):
        for file in files:
            full_path = os.path.join(root, file)
            print(full_path)  # Print all filenames

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Find files with non-UTF-8 characters in their names.")
    parser.add_argument("directory", type=str, help="Path to the directory to scan")

    args = parser.parse_args()
    find_non_utf8_filenames(args.directory)
