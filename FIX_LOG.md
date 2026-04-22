# Scraper Fixes & Enhancements

## Previous Mistakes
1. **Ineffective Row Parsing**: The initial logic attempted to find "Open" or "Opening" rows, but the page structure was more complex, leading to empty results.
2. **Incorrect Scoping**: Scoping to the entire page body resulted in picking up irrelevant player prop stats ("o0.5", "u0.5") instead of the game's actual Over/Under.
3. **Improper Tab Switching**: The script would only extract full-game data because the F5 switch and subsequent data extraction were not reliably targeting the updated DOM content.

## Current Fixes
1. **Targeted Table Scoping**: The logic now explicitly identifies the main odds table by searching for its header ('Matchup', 'Total', 'Moneyline').
2. **Robust Regex Extraction**: Implemented a regex to specifically extract the Total line ('o'/'u' followed by a number), ensuring we correctly distinguish full-game totals from other odds (spread/moneyline).
3. **State Awareness**: Ensured that the getOdds function is called after each tab switch (Full Game -> F5), allowing the scraper to reliably capture totals for both periods.