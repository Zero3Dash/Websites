✨ What It Does
    Create templates – Write any text (configs, scripts, letters, etc.) and mark placeholders as {{variable name}}.
    Save & reuse – Templates are saved in your browser’s local storage. You can load, edit, or delete them anytime.
    Fill & generate – Each template automatically generates a form with fields for all variables. Fill them in and click to see the completed output.
    Share via link – Generate a shareable URL that includes the template ID and any pre‑filled values. Anyone with that link will see the same template and values.
    Embed – Copy ready‑to‑use <iframe> snippets to embed the tool (with the current template) on another website.

🚀 How to Use
    Open the HTML file in any modern browser (Chrome, Firefox, Edge, Safari).
    Create a new template:
        In the “Create new template” box, type your text with variables in {{...}}.
        Click “Save as new template” and give it a name.
    Load a saved template:
        Choose a template from the dropdown and click “Load”.
    Fill in the values:
        The form below the template updates automatically. Enter your values.
        Click “Generate Filled Template” to see the result.
    Share:
        Click “Copy shareable link” to get a URL that loads this template and pre‑fills the current values.
        Use the embed codes at the bottom to place the tool on another page.

🧠 Technical Notes
    No server – Everything runs in your browser. Templates are saved in localStorage and never leave your machine.
    Share links – They contain the template ID and form values as URL query parameters. Opening such a link restores the exact state.
    Default template – A router configuration snippet is provided as an example, matching the original 4peg.com.
    Syntax – Variables use {{...}} (you can put spaces inside, e.g. {{IP Address}}).

📜 Background

The original 4peg.com was a simple tool for sharing templated text, popular among network engineers and script writers. This replica aims to preserve that idea while adding modern conveniences like persistent storage and easy sharing. It’s a static HTML file – you can host it anywhere or just run it locally.
🛠️ Files
    index.html – The complete application (all CSS and JavaScript are embedded).

📄 License
Feel free to use, modify, and share this code. No attribution required.
