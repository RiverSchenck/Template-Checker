import { Global } from "@emotion/react"

const Fonts = () => (
  <Global
    styles={`
        @font-face {
            font-family: "Space Grotesk Frontify";
            src:          url("/fonts/SpaceGroteskFrontify-Light.woff2") format("woff2"),
                url("/fonts/SpaceGroteskFrontify-Light.woff") format("woff");
            font-weight: 300;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Space Grotesk Frontify";
            src:          url("/fonts/SpaceGroteskFrontify-Regular.woff2") format("woff2"),
                url("/fonts/SpaceGroteskFrontify-Regular.woff") format("woff");
            font-weight: 400;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Menlo";
            src:          url("/fonts/Menlo-Regular.woff") format("woff"),
                url("/fonts/Menlo-Regular.ttf") format("truetype");
            font-weight: 400;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Menlo";
            src:          url("/fonts/Menlo-Italic.woff") format("woff"),
                url("/fonts/Menlo-Italic.ttf") format("truetype");
            font-weight: 400;
            font-style: italic;
        }
        
        @font-face {
            font-family: "Space Grotesk Frontify";
            src:          url("/fonts/SpaceGroteskFrontify-Medium.woff2") format("woff2"),
                url("/fonts/SpaceGroteskFrontify-Medium.woff") format("woff");
            font-weight: 500;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Space Grotesk Frontify";
            src:          url("/fonts/SpaceGroteskFrontify-SemiBold.woff2") format("woff2"),
                url("/fonts/SpaceGroteskFrontify-SemiBold.woff") format("woff");
            font-weight: 600;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Space Grotesk Frontify";
            src:          url("/fonts/SpaceGroteskFrontify-Bold.woff2") format("woff2"),
                url("/fonts/SpaceGroteskFrontify-Bold.woff") format("woff");
            font-weight: 700;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Menlo";
            src:          url("/fonts/Menlo-Bold.woff") format("woff"),
                url("/fonts/Menlo-Bold.ttf") format("truetype");
            font-weight: 700;
            font-style: normal;
        }
        
        @font-face {
            font-family: "Menlo";
            src:          url("/fonts/Menlo-BoldItalic.woff") format("woff"),
                url("/fonts/Menlo-BoldItalic.ttf") format("truetype");
            font-weight: 700;
            font-style: italic;
        }
      `}
  />
)

export default Fonts;