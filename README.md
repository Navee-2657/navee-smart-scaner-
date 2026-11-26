# Navee’s Smart Scanner
Static page (`public/`) plus three serverless functions (`api/`) that fetch quotes and search from Yahoo Finance.

## Deploy (free, about 5 minutes)
1. Create a free account at vercel.com and push this folder to a new GitHub repository.
2. In Vercel choose Add New > Project, import the repository, leave every setting as default, click Deploy.
3. Open the link Vercel gives you and put it in your CV.
No build step or environment variables are needed.

## Test locally
`npm i -g vercel` then `vercel dev` inside this folder.

## Notes
- If the data source blocks or rate-limits, the page falls back to sample data and shows it in the status label.
- The Yahoo endpoints are unofficial. For heavier use, switch the three files in `api/` to a keyed provider such as Twelve Data or EODHD.
