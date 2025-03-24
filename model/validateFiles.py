import os
import argparse

def find_non_utf8_filenames(directory):
    for root, _, files in os.walk(directory):
        for file in files:
            try:
                file.encode('utf-8')  # Try encoding the filename as UTF-8
            except UnicodeEncodeError as e:
                print(f"🚨 Problematic file: {os.path.join(root, file)}")
                print(f"❌ Error details: {e}")
                print(f"🔎 Non-UTF-8 characters: {[hex(ord(c)) for c in file if ord(c) > 127]}\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Find files with non-UTF-8 characters in their names.")
    parser.add_argument("directory", type=str, help="Path to the directory to scan")

    args = parser.parse_args()
    find_non_utf8_filenames(args.directory)
