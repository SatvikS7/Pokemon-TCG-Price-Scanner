import os

data_dir = '../dataset/neg_data/'
num = 0
for root, _, files in os.walk(data_dir):
    for file in files:
        try:
            os.rename(os.path.join(root, file), os.path.join(root, f"neg_data_{num}.jpg"))
        except Exception as e:
            print(f"Problematic file: {file} - {e}")
            break
        num += 1

data_dir = '../dataset/pos_data/'
num = 0
for root, _, files in os.walk(data_dir):
    for file in files:
        try:
            os.rename(os.path.join(root, file), os.path.join(root, f"pos_data_{num}.jpg"))
        except Exception as e:
            print(f"Problematic file: {file} - {e}")
            break
        num += 1