from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
from sentence_transformers import SentenceTransformer, util
import re
import unidecode

def clean_text(text):
    if pd.isna(text):
        return ""
    text = text.lower()
    text = unidecode.unidecode(text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return text

    
df = pd.read_csv("data/base_de_donnees/films_series_200_filled.csv")

df["description"] = df["title"] + " " + df["genre"] * 2 + " " + df["synopsis"] * 3
df["description"] = df["description"].apply(clean_text)


model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
embeddings = model.encode(df["description"].tolist(), convert_to_tensor=True)

idx = df[df["title"] == "Inception"].index[0]
scores = util.cos_sim(embeddings[idx], embeddings)[0]
top_idx = scores.argsort(descending=True)[1:6]
df.iloc[top_idx][["title", "genre"]]

print(df.iloc[top_idx][["title", "genre"]])