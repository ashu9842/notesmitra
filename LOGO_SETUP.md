# Logo Setup Instructions

## How to Add the NotesMitra Logo

1. **Save the logo image** that was provided (the circular NM logo) as `logo.png`

2. **Place it in the public folder:**
   ```
   Notes/public/logo.png
   ```

3. The logo will automatically be used as:
   - Website favicon (browser tab icon)
   - Main logo in the header
   - Apple touch icon for mobile devices

## Current Setup

- **Favicon:** Configured in `index.html` to use `/logo.png`
- **Header Logo:** Used in `App.tsx` with circular styling
- **Logo Component:** Available at `src/app/components/Logo.tsx` for reuse throughout the app

## Logo Specifications

- Format: PNG with transparent background recommended
- Size: Minimum 512x512px for best quality
- Shape: Circular design (NM monogram)
- Colors: Black background with white text

## Usage in Components

You can import and use the Logo component anywhere in your app:

```tsx
import Logo from '@/app/components/Logo';

// Usage
<Logo size="md" className="custom-classes" />

// Available sizes: 'sm', 'md', 'lg', 'xl'
```

## Verification

After placing the logo:
1. Restart the dev server: `npm run dev`
2. Check browser tab for favicon
3. Check header for logo display
4. Verify logo loads correctly at http://localhost:5173/logo.png
