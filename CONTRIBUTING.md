# Contributing a Book

Thank you for sharing a book with the Ebook Hub community.

## 1. Check the License

Only these licenses are accepted:

| License | Examples |
| --- | --- |
| `public-domain` | Works whose copyright has expired, such as many Project Gutenberg titles |
| `CC0-1.0` | Works dedicated to the public domain |
| `CC-BY-4.0` | Attribution required |
| `CC-BY-SA-4.0` | Attribution and share-alike required |

- The edition or translation you submit must be free too, not only the original work.
- `source` must link to the original publication that shows the license.
- When in doubt, do not submit. Infringing books can take the whole library down.

## 2. Add the Book

```fish
cp -r templates/book books/<language>/<slug>
```

- `<language>`: lowercase ISO 639 code, for example `en` or `vi`.
- `<slug>`: lowercase kebab-case, unique across all languages, for example `truyen-kieu`.

Edit `book.json`:

| Field | Rules |
| --- | --- |
| `title` | Required, at most 200 characters |
| `authors` | Required, non-empty list of names |
| `language` | Required, must match the folder |
| `categories` | Required, values from [`categories.json`](categories.json), no repeats |
| `license` | Required, one of the licenses above |
| `source` | Required, `https` URL of the original publication |
| `version` | Required, semantic version such as `1.0.0`; bump it when you change the text |
| `summary` | Optional, at most 280 characters |
| `chapters` | Required, ordered list of `{ "title", "file" }` with files named `chapters/0001.md` |

Chapter files:

- UTF-8 Markdown, not empty, at most 2 MB each; the whole book at most 20 MB.
- No raw HTML, HTML comments, or images.
- No `javascript:`, `data:`, `vbscript:`, or `file:` links.
- Only `book.json` and the chapter files it lists may exist in the book folder.

## 3. Validate and Open a Pull Request

```fish
npm install
npm run validate
```

- Do not commit `index.json`; CI regenerates it after merge.
- Fill in the pull request checklist.
- Adding a category means editing `categories.json` in the same pull request and explaining why.
