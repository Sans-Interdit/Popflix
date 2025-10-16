from flask import Flask, request, jsonify
import csv
from flask_cors import CORS
from openai import OpenAI

app = Flask("Popflix")
CORS(app)

chatbot_key = "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"

client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=chatbot_key,
)


@app.route("/chat", methods=["POST"])
def chat():
    completion = client.chat.completions.create(
        extra_body={"mode": "non-thinking",},
        model="qwen/qwen3-235b-a22b:free",
        messages=[
            {
                "role": "system",
                "content": "Tu es un assistant virtuel spécialisé dans la recommendation de séries et de films. Your answers should contain maximum 30 words."
            },
            {
                "role": "user",
                "content": request.json.get("message")
            }
        ]
    )
    print(completion.choices[0].message.content)
    return jsonify({'response': completion.choices[0].message.content}), 200

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
