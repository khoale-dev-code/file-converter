# Fix PDF Split Functionality

## Current Issue
- Frontend preview shows pages 4-21 correctly
- Downloaded PDF missing some/all pages from range
- Root cause: Backend merge logic or ConvertAPI response incomplete

## Approved Plan
- [ ] Fix backend `file-forge-backend/src/index.js`:
  - [ ] Add detailed logging (expected/received pages)
  - [ ] Robust page number extraction from ConvertAPI filenames  
  - [ ] Explicit numeric sorting of pages
  - [ ] Validate received pages match expected count/range
  - [ ] Error if mismatch

## Implementation Steps
1. [x] **Create TODO.md** ✅ 
2. [x] Edit `file-forge-backend/src/index.js` ✅:
   - [x] Added detailed logging (expected/received pages, file processing)
   - [x] Robust page number extraction (`/page[s]?\.?_?(\d+)/i`)
   - [x] Numeric sorting + pageInfos tracking  
   - [x] Count validation with error throw
3. [ ] Deploy/test backend changes
4. [ ] Test with 32-page PDF (4-21):
   - Verify preview shows 18 pages  
   - Download → check contains exactly pages 4-21 (18 pages)
5. [ ] Update TODO.md with test results
6. [ ] Mark complete

## Backend Files to Edit
- `file-forge-backend/src/index.js`

## Testing Command
```bash
# After backend deploy, test via curl or browser
curl -F "file=@test.pdf" -F "action=Split PDF" -F "options=4-21" https://file-forge-backend.file-forge-api.workers.dev/process
