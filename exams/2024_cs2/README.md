# GATE 2024 CS2 Dataset

- **Paper**: Computer Science & Information Technology (CS2 / Set 2)
- **Year**: 2024
- **Organizer**: IISc Bengaluru
- **Questions**: 65
- **Marks**: 100

## Files
- `questions.json` — frontend-safe
- `answers.json` — official key + marking (server-side)
- `assets/` — tightly cropped figures and image-based options

Every question includes a 1-based `source_page` pointing to its page in the question PDF. Question figures are referenced from `questions.json`; image-based options are referenced from `answers.json` with `assets_for_options: true`.

## Formatting
- Mathematical notation uses LaTeX where it improves clarity.
- Tabular data uses structured `headers` and `rows`.
- Code and SQL use fenced code blocks.

## Sources
- Question paper: `../../2024_CS2.pdf`
- Answer key: `../../2024_CS2FinalAnswerKey.pdf`

## Types
- MCQ / MSQ / NAT as per official key
