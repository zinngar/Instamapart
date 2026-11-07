# Instamapart

Turn any image into a [Litematica](https://www.curseforge.com/minecraft/mc-mods/litematica) schematic (`.litematic`). Build it flat on the ground as map art, stand it upright as a wall, or put it at any angle in 3D space, at whatever size you want.

**Live Demo:** [https://zinngar.github.io/Instamapart/](https://zinngar.github.io/Instamapart/)

**Hosted on GitHub:** [zinngar/Instamapart](https://github.com/zinngar/Instamapart)

## How to Use

1.  **Upload an Image.** You'll see a preview of the picture in blocks and a 3D preview you can drag to look around.
2.  **Pick a Size.** Use a map preset (1x1 to 4x4 maps) or type any width and height in blocks, up to 512. Leave "Keep image shape" checked to keep the image's proportions.
3.  **Pick Blocks.** Choose a block palette, or switch individual blocks on and off under "Choose which blocks to use". Transparent pixels become air, which is handy for cut-out shapes.
4.  **Pick an Angle.** Choose a preset (flat, upright facing any direction, ceiling) or set your own angle:
    - **Tilt back**: leans the top of the picture away from you. 90° is lying flat with the top pointing north.
    - **Turn**: rotates around the vertical axis, like Minecraft yaw (90° = facing west).
    - **Spin**: rotates the picture within its own plane.
    - **Fill gaps** makes angled pictures thicker so you can't see through them, at the cost of more blocks.
5.  **Swap Blocks (optional).** "Blocks in this schematic" lists every block used with how many you need. Swap any of them for another block, including one you type in yourself (the closest colours are suggested first), or choose "Don't use" to rematch those pixels to your other blocks.
6.  **Generate Litematic**, then download it. Put the file in `.minecraft/schematics` and load it with Litematica.

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
