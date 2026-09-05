export const metadata = { title: "API Docs | Evergreen" };
export default function ApiDocs() {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui" />
        <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" />
        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('load',()=>{window.ui=SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger-ui',withCredentials:true})})` }} />
      </body>
    </html>
  );
}
