# Minecraft Map Art Maker

This web application allows you to create Minecraft map art from any image. You can upload an image, select the desired map size, and the application will generate a `.schematic` file that you can use in Minecraft with tools like WorldEdit or Litematica.

**Live Demo:** [https://zinngar.github.io/Instamapart/](https://zinngar.github.io/Instamapart/)

**Hosted on GitHub:** [zinngar/Instamapart](https://github.com/zinngar/Instamapart)

## GitHub Pages Deployment

To deploy this application to GitHub Pages, follow these steps:

1.  Go to your repository settings on GitHub.
2.  Navigate to **Pages** in the sidebar.
3.  Under **Build and deployment > Source**, select **GitHub Actions**.
4.  Push any changes to the `main` branch, and the site will be automatically deployed.

## How to Use

1.  **Upload an Image:** Click the "Choose File" button to select an image from your computer. The application will display a preview of the image.
2.  **Select Map Size:** Choose the desired size for your map art from the "Map Size" dropdown. The options are 1x1, 2x2, and 3x3 maps. The application will resize the image to fit the selected size while maintaining its aspect ratio.
3.  **Generate Schematic:** Click the "Generate Schematic" button to process the image and create the `.schematic` file.
4.  **Download Schematic:** A "Download Schematic" link will appear. Click it to save the `.schematic` file to your computer.

## Running Locally

This application uses modern JavaScript modules (`type="module"`), which are blocked by browser security policies when you open the `index.html` file directly from your computer (i.e., using a `file:///...` path). To make it work, you need to serve the files from a simple local web server.

Here are a few easy ways to do this:

### Option 1: Using Python (Recommended if you have Python)

Most systems (macOS, Linux, and Windows with the Python installer) have Python. This is often the quickest method.

1.  Open a terminal (like Command Prompt, PowerShell, or Terminal) in the project folder.
2.  Try running one of the following commands. If one doesn't work, try the next one:

    ```bash
    # For Python 3 (most common)
    python3 -m http.server
    ```

    ```bash
    # For Windows, or if the above fails
    py -m http.server
    ```

    ```bash
    # For older systems with Python 2
    python -m SimpleHTTPServer
    ```
3.  Once the server is running, open your browser and go to `http://localhost:8000`.

### Option 2: Using Node.js / NPX (Recommended for developers)

If you have Node.js and npm installed, you can use the `serve` package without installing anything permanently.

1.  Open a terminal in the project folder.
2.  Run the following command:
    ```bash
    npx serve
    ```
3.  The command will output a local address (usually `http://localhost:3000`). Open that address in your browser.

### Option 3: Using a VS Code Extension (Easiest graphical option)

If you use Visual Studio Code as your editor, the **Live Server** extension is a great one-click solution.

1.  Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension from the VS Code Marketplace.
2.  Open the project folder in VS Code.
3.  Right-click the `index.html` file and select "Open with Live Server". A browser window will automatically open with the correct local server address.
