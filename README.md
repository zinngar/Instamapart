# Minecraft Map Art Maker

This web application allows you to create Minecraft map art from any image. You can upload an image, select the desired map size, and the application will generate a `.schematic` file that you can use in Minecraft with tools like WorldEdit or Litematica.

## How to Use

1.  **Upload an Image:** Click the "Choose File" button to select an image from your computer. The application will display a preview of the image.
2.  **Select Map Size:** Choose the desired size for your map art from the "Map Size" dropdown. The options are 1x1, 2x2, and 3x3 maps. The application will resize the image to fit the selected size while maintaining its aspect ratio.
3.  **Generate Schematic:** Click the "Generate Schematic" button to process the image and create the `.schematic` file.
4.  **Download Schematic:** A "Download Schematic" link will appear. Click it to save the `.schematic` file to your computer.

## Running Locally

Because this application uses modern JavaScript modules, you need to run it from a local web server to avoid browser security errors (CORS policy). Opening the `index.html` file directly will not work.

The easiest way to do this is to use Python's built-in web server.

1.  **Open a terminal or command prompt** in the same directory as the `index.html` file.
2.  **Run the following command:**

    ```bash
    python -m http.server
    ```

    If you have Python 2, the command is `python -m SimpleHTTPServer`.

3.  **Open your web browser** and go to the address `http://localhost:8000`. The application should now work correctly.
