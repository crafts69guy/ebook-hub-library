# Contributing a Book

Thank you for sharing a book with the Ebook Hub community.

## 1. Check the License

Only these licenses are accepted:

| License | Examples |
| --- | --- |
| `public-domain` | Works whose copyright has expired, such as many Project Gutenberg titles |
| `CC0-1.0` | Works dedicated to the public domain |
| `CC-BY-4.0`, `CC-BY-3.0` | Attribution required |
| `CC-BY-SA-4.0`, `CC-BY-SA-3.0` | Attribution and share-alike required |

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
| `images` | Optional, list of bundled image paths named `images/0001.png` |

Chapter files:

- UTF-8 Markdown, not empty, at most 2 MB each; the whole book at most 20 MB.
- No raw HTML or HTML comments.
- No `javascript:`, `data:`, `vbscript:`, or `file:` links.
- Only `book.json` and the files it lists may exist in the book folder.

Images:

- Bundle them in the book folder as `images/0001.png`, and list every one in
  `images`. PNG, JPEG, and WebP are accepted, at most 2 MB each.
- Reference them from a chapter exactly as they are listed:
  `![Plate I](images/0001.png)`. Every listed image must be used, and every
  used image must be listed.
- Remote images are rejected. Nothing outside this repository is covered by the
  index digests, and fetching one while reading would tell its host who is
  reading what.

## 3. Validate and Open a Pull Request

```fish
npm install
npm run validate
```

- Do not commit `index.json`; CI regenerates it after merge.
- Fill in the pull request checklist.
- Adding a category means editing `categories.json` in the same pull request and explaining why.
