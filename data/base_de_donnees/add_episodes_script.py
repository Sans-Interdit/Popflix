import csv
from rapidfuzz import process, fuzz

def main():
    csvUrl1 = "data/base_de_donnees/films_series_200_filled.csv"
    csvUrl2 = "data/base_de_donnees/TMDB_tv_dataset_v3.csv" # Dataset not committed to the repo for size reasons
    output_csv = "data/base_de_donnees/films_series_200_filled_episodes.csv"

    with open(csvUrl2, newline='', encoding='utf-8') as f2:
        reader2 = csv.DictReader(f2)
        tv_data = {row["name"]: row["number_of_episodes"] for row in reader2 if row["name"]}

    names2 = list(tv_data.keys())

    with open(csvUrl1, newline='', encoding='utf-8') as f1:
        reader1 = csv.DictReader(f1)
        fieldnames = reader1.fieldnames + ["number_of_episodes"]

        with open(output_csv, "w", newline='', encoding='utf-8') as fout:
            writer = csv.DictWriter(fout, fieldnames=fieldnames)
            writer.writeheader()

            for row in reader1:
                title = row["title"]

                match, score, _ = process.extractOne(
                    title, names2, scorer=fuzz.token_sort_ratio
                )

                if score > 85:
                    row["number_of_episodes"] = tv_data[match]
                else:
                    row["number_of_episodes"] = ""

                writer.writerow(row)

    print(f"✅ Fusion terminée avec correspondance floue → {output_csv}")

if __name__ == "__main__":
    main()
