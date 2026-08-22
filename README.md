# Montana Tech Lab

Landing page comercial estática com diagnóstico expresso, formulário de qualificação e função serverless para encaminhar leads a um destino configurável.

## Desenvolvimento local

Os arquivos da página não exigem build. Sirva a raiz do projeto com um servidor HTTP local. O endpoint `/api/leads` só funciona no ambiente Vercel ou com uma execução local compatível com Vercel Functions; em um servidor estático, o formulário mostrará o fallback pelo Direct, como esperado.

## Captação de leads

A função `api/leads.js` valida o payload, aplica honeypot e uma limitação de requisições por IP de melhor esforço no ambiente serverless. Ela só retorna sucesso quando o webhook configurado responde com sucesso.

Configure na Vercel:

- `LEAD_WEBHOOK_URL`: URL HTTPS do fluxo que receberá o lead (CRM, automação ou backend próprio).
- `LEAD_WEBHOOK_SECRET`: segredo opcional enviado no header `Authorization: Bearer`.

O destino recebe:

```json
{
  "source": "montana-landing-page",
  "lead": {
    "formType": "express",
    "name": "Nome informado",
    "company": "Projeto informado",
    "contact": "Canal informado",
    "consent": true,
    "submittedAt": "ISO-8601"
  }
}
```

Não registre o corpo do lead em logs públicos. Teste o fluxo completo com um envio controlado antes do deploy de produção.

## Agenda

Quando houver uma agenda oficial, preencha a meta tag abaixo em `index.html`:

```html
<meta name="montana:scheduler-url" content="https://agenda-oficial.example/">
```

O botão de agenda só aparece depois que o lead foi realmente entregue ao webhook.

## Cases e logos

A versão atual usa setores e cases anônimos. Os arquivos internos de portfólio estão excluídos do deploy por `.vercelignore`. Substitua a faixa de setores por logos somente depois de confirmar autorização de uso de marca e receber os arquivos oficiais em SVG ou WebP.

## Publicação

O projeto está configurado para deploy na Vercel, com URLs limpas, headers de segurança, `robots.txt` e `sitemap.xml`. A pasta `docs`, os arquivos internos de `portfolio` e imagens-fonte não utilizadas não são enviados ao site público.
