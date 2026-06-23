# Naslediye A. Pristavkina

Static HTML/CSS school literature website about Anatoly Pristavkin and the story "Ночевала тучка золотая".

The public version is hosted on Netlify and may later be linked from the school Joomla website under the "Projekte" section.

## Pages

- `index.html` - start page
- `biografie.html` - biography of Anatoly Pristavkin
- `werke.html` - works
- `buch.html` - book overview
- `characters.html` - characters
- `plot.html` - plot
- `relevance.html` - relevance of the story
- `forum.html` - discussion forum for the relevance of the story
- `polit-situation.html` - political situation
- `polit-bemuehungen.html` - political efforts

## Preview Locally

Open `index.html` in a web browser.

No build step is required.

The discussion forum uses a Netlify Function, so comments only work on the Netlify-hosted site or when the site is run through Netlify tooling locally.

## Discussion Forum

`forum.html` provides a lightweight discussion forum for the topic "Актуальность повести «Ночевала тучка золотая»".

Comments are saved through the Netlify Function at `/.netlify/functions/comments`. The function stores comment data with Netlify Blobs. Each comment stores only:

- display name, or `Анонимно` when no name is entered
- selected discussion topic
- message text
- creation timestamp
- generated comment id

The form does not ask for email and does not include accounts or login. This is a small school-project forum, not a full account-based forum.

Validation is handled by the Netlify Function:

- message is required
- message is limited to 1000 characters
- display name is limited to 40 characters
- topic must be one of the fixed forum topics
- comments with more than one URL are rejected
- a hidden honeypot field helps reject simple spam bots

If the Netlify CLI is available, local testing can be done with:

```bash
netlify dev
```

Then open the local Netlify URL and visit `forum.html`. Opening `forum.html` directly from the filesystem will show the page, but comments require the Netlify Function endpoint.

## Integration note for school/Joomla

The site can still be linked from the school Joomla page under a "Projekte" section.

The forum runs on the Netlify-hosted version of this static site. If the school wants the forum inside Joomla itself, the same visual/content structure can be copied, but comment storage would need a Joomla-compatible comments or forum module.

The current implementation stores comments on Netlify, not inside Joomla.

## Development Workflow

All changes should happen through branches and pull requests.

Do not commit directly to `main`.
