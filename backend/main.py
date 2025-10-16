from flask import Flask, request, jsonify
import csv
from flask_cors import CORS
from openai import OpenAI
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd
from sentence_transformers import SentenceTransformer, util
import re
import unidecode


app = Flask("Popflix")
CORS(app)

chatbot_key = "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"

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=chatbot_key,
)

def clean_text(text):
    if pd.isna(text):
        return ""
    text = text.lower()
    text = unidecode.unidecode(text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return text

@app.route("/recommend", methods=["POST"])
def recommend():
    # Charger la base
    df = pd.read_csv("data/base_de_donnees/films_series_200_filled.csv")
    
    # Préparer la description
    df["description"] = df["title"] + " " + df["genre"] * 2 + " " + df["synopsis"] * 3
    df["description"] = df["description"].apply(clean_text)
    
    # Créer les embeddings
    model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    embeddings = model.encode(df["description"].tolist(), convert_to_tensor=True)
    
    # Récupérer la liste des films depuis la requête
    films_list = request.json.get("list")
    print(films_list)
    if not films_list:
        return jsonify({"error": "Aucune liste de films fournie"}), 400

    # Trouver les indices des films dans le dataframe
    indices = [df[df["title"] == film].index[0] for film in films_list if film in df["title"].values]

    if not indices:
        return jsonify({"error": "Aucun film de la liste n'a été trouvé"}), 404

    # Calculer la similarité et combiner les scores
    combined_scores = None
    for idx in indices:
        scores = util.cos_sim(embeddings[idx], embeddings)[0]
        if combined_scores is None:
            combined_scores = scores
        else:
            combined_scores += scores  # somme des similarités pour tous les films
    
    # Exclure les films déjà dans la liste
    for idx in indices:
        combined_scores[idx] = -1
    
    # Prendre les top 5 recommandations
    top_idx = combined_scores.argsort(descending=True)[:5]

    return jsonify({'result': df.iloc[top_idx][["title", "genre"]].to_dict(orient='records')}), 200


@app.route("/chat", methods=["POST"])
def chat():
    system_prompt = ""
    if request.json.get("mode") == "detection":
        system_prompt = "Votre rôle est de déterminer si le message de l'utilisateur demande une recommandation d'une œuvre audiovisuelle. Répondez 'oui' si l'utilisateur demande une recommandation d'anime, de film ou de série, et 'non' dans le cas contraire."
    elif request.json.get("mode") == "recommendation":
        result = request.json.get("result")
        system_prompt = f"L'utilisateur a demandé des recommandations audiovisuelles. Voici cinq meilleures correspondances : {result}. Répondez avec deux sélections, en fournissant des informations brèves et exactes sans invention, en moins de 50 mots."
    else:
        system_prompt = "Tu es un assistant virtuel spécialisé dans la recommendation de séries et de films. Your answers should contain maximum 30 words."

    completion = client.chat.completions.create(
        extra_body={"mode": "non-thinking", "function_call": "none"},
        model="qwen/qwen3-235b-a22b:free",
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": request.json.get("message")
            }
        ]
    )
    response = completion.choices[0].message.content
    cleaned = re.sub(r"<think>.*?</think>", "", response, flags=re.DOTALL)
    cleaned = re.sub(r"\n", " ", cleaned)
    return jsonify({'response': cleaned.strip()}), 200

@app.route("/get_event", methods=["GET"])
def get_event():
    csvUrl = "data/base_de_donnees/films_series_200_filled_episodes.csv"

    id = request.args.get("id")
    print(id)
    if not id:
        return jsonify({'error': 'missing id'}), 400

    try:
        with open(csvUrl, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['id'] == id:
                    return jsonify({
                        'id': row['id'],
                        'title': row['title'],
                        'poster': row['poster'],
                        'year': row['year'],
                        'type': row['type'],
                        'genre': row['genre'],
                        'synopsis': row['synopsis'],
                        'number_of_episodes': int(row['number_of_episodes']) if  row['number_of_episodes'] != "nan" else None
                    }), 200

        return jsonify({'error': f'No entry found for id {id}'}), 404

    except FileNotFoundError:
        return jsonify({'error': f'File not found: {csvUrl}'}), 500

    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
