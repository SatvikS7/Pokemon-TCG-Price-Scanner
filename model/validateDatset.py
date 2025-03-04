import os

data_dir = '../dataset/neg_data/'
for root, _, files in os.walk(data_dir):
    for file in files:
        try:
            path = os.path.join(root, file)
            with open(path, 'rb') as f:
                f.read().decode('utf-8', errors='strict')
        except Exception as e:
            print(f"Problematic file: {path} - {e}")