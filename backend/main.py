from flask import Flask, request, jsonify
import csv
from flask_cors import CORS

app = Flask("Popflix")
CORS(app)  # Autorise les requêtes depuis d'autres origines (localhost:5500 inclus)

@app.route("/get_event", methods=["GET"])
def get_event():
    csvUrl = "data/base_de_donnees/films_series_200_filled.csv"

    id = request.args.get("id")
    print(id)
    if not id:
        return jsonify({'error': 'missing id'}), 400

    try:
        with open(csvUrl, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['id'] == id:
                    # Si on trouve le film correspondant à l'id, on le renvoie
                    return jsonify({
                        'id': row['id'],
                        'title': row['title'],
                        'poster': row['poster'],
                        'year': row['year'],
                        'type': row['type'],
                        'genre': row['genre'],
                        'synopsis': row['synopsis']
                    }), 200

        # Si aucun film ne correspond à l'id
        return jsonify({'error': f'No entry found for id {id}'}), 404

    except FileNotFoundError:
        return jsonify({'error': f'File not found: {csvUrl}'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
