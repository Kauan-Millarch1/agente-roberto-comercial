# N8N Nodes — Message Logging (`roberto_messages`)

Instructions to add message logging nodes to the Roberto Comercial workflow.

---

## Node 1: `mapear_tipo_midia` (Code)

Resolves the message content and media type for inbound messages.
Handles text, audio (transcription), and image (description).

**Paste this node in the canvas** (position near `parametros`, to the right and below):

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "// Resolve content and media_type for inbound message logging\nconst tipo = $json['evento-tipo'];\nlet content = $json['contato-msg'] || '';\n\n// For audio: get transcription from Edit Fields1\nif (tipo === 'audio') {\n  try { content = $('Edit Fields1').first().json.Mensagem || content; } catch(e) {}\n}\n// For image: get description from Analyze image\nif (tipo === 'image') {\n  try {\n    const r = $('Analyze image').first().json;\n    const msg = r.message || {};\n    const c = msg.content || [];\n    content = (c[0] && c[0].text) || r.text || content;\n  } catch(e) {}\n}\n\n// Get WhatsApp Message ID for traceability\nlet wamid = '';\ntry { wamid = $('When Executed by Another Workflow').first().json.message.id || ''; } catch(e) {}\n\nconst mediaMap = { 'text': 'text', 'audio': 'audio_input', 'image': 'image' };\n\nreturn [{\n  json: {\n    phone: $json['contato-wpp'],\n    direction: 'inbound',\n    content: content,\n    media_type: mediaMap[tipo] || 'text',\n    wamid: wamid\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-27328, -480],
      "id": "msg-log-001",
      "name": "mapear_tipo_midia",
      "continueOnFail": true
    }
  ],
  "connections": {}
}
```

---

## Node 2: `salvar_msg_inbound` (Supabase INSERT)

Saves the inbound message to `roberto_messages`.

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "create",
        "tableId": "roberto_messages",
        "fieldsUi": {
          "fieldValues": [
            {
              "fieldId": "phone",
              "fieldValue": "={{ $json.phone }}"
            },
            {
              "fieldId": "direction",
              "fieldValue": "={{ $json.direction }}"
            },
            {
              "fieldId": "content",
              "fieldValue": "={{ $json.content }}"
            },
            {
              "fieldId": "media_type",
              "fieldValue": "={{ $json.media_type }}"
            },
            {
              "fieldId": "wamid",
              "fieldValue": "={{ $json.wamid }}"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [-26928, -480],
      "id": "msg-log-002",
      "name": "salvar_msg_inbound",
      "continueOnFail": true,
      "credentials": {
        "supabaseApi": {
          "id": "y1A73j53rbYyyoK7",
          "name": "Supabase Roberto"
        }
      }
    }
  ],
  "connections": {}
}
```

---

## Node 3: `salvar_msg_outbound` (Supabase INSERT)

Saves each outbound text/CTA message to `roberto_messages`.
Placed after both send nodes (text and CTA button).

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "create",
        "tableId": "roberto_messages",
        "fieldsUi": {
          "fieldValues": [
            {
              "fieldId": "phone",
              "fieldValue": "={{ $('parametros').first().json['contato-wpp'] }}"
            },
            {
              "fieldId": "direction",
              "fieldValue": "outbound"
            },
            {
              "fieldId": "content",
              "fieldValue": "={{ $('selecionar_mensagem').first().json.mensagem_atual }}"
            },
            {
              "fieldId": "media_type",
              "fieldValue": "text"
            },
            {
              "fieldId": "wamid",
              "fieldValue": "={{ $json.messages ? $json.messages[0].id : '' }}"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [-10300, 600],
      "id": "msg-log-003",
      "name": "salvar_msg_outbound",
      "continueOnFail": true,
      "credentials": {
        "supabaseApi": {
          "id": "y1A73j53rbYyyoK7",
          "name": "Supabase Roberto"
        }
      }
    }
  ],
  "connections": {}
}
```

---

## Node 4: `salvar_msg_outbound_audio` (Supabase INSERT)

Saves the audio outbound message to `roberto_messages`.
Placed after the WhatsApp audio send node.

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "create",
        "tableId": "roberto_messages",
        "fieldsUi": {
          "fieldValues": [
            {
              "fieldId": "phone",
              "fieldValue": "={{ $('parametros').first().json['contato-wpp'] }}"
            },
            {
              "fieldId": "direction",
              "fieldValue": "outbound"
            },
            {
              "fieldId": "content",
              "fieldValue": "={{ $('openAI_audio1').first().json.text || '' }}"
            },
            {
              "fieldId": "media_type",
              "fieldValue": "audio_output"
            },
            {
              "fieldId": "wamid",
              "fieldValue": "={{ $json.messages ? $json.messages[0].id : '' }}"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [-11000, 1600],
      "id": "msg-log-004",
      "name": "salvar_msg_outbound_audio",
      "continueOnFail": true,
      "credentials": {
        "supabaseApi": {
          "id": "y1A73j53rbYyyoK7",
          "name": "Supabase Roberto"
        }
      }
    }
  ],
  "connections": {}
}
```

---

## Wiring Instructions

After pasting all 4 nodes, draw these connections manually in the N8N editor:

### Inbound (Nodes 1 + 2)

1. **`parametros`** → **`mapear_tipo_midia`**
   - Drag a NEW connection from `parametros` output to `mapear_tipo_midia` input
   - This is a PARALLEL branch (don't disconnect the existing `parametros` → `Redis_GET_lock` and `parametros` → `cancelar_vacuo` connections)

2. **`mapear_tipo_midia`** → **`salvar_msg_inbound`**
   - Connect the output of `mapear_tipo_midia` to `salvar_msg_inbound` input

### Outbound Text/CTA (Node 3)

3. **`Send message and wait for response`** → **`salvar_msg_outbound`**
   - Drag a NEW connection from the text send node to `salvar_msg_outbound`
   - Keep the existing connection to `Merge1` (index 1) — this is a parallel branch

4. **`enviar_botao_cta`** → **`salvar_msg_outbound`**
   - Drag a NEW connection from the CTA button send node to `salvar_msg_outbound`
   - Keep the existing connection to `Merge1` (index 0) — this is a parallel branch

### Outbound Audio (Node 4)

5. **`Send message and wait for response1`** → **`salvar_msg_outbound_audio`**
   - Drag a NEW connection from the audio send node to `salvar_msg_outbound_audio`
   - Keep the existing connection to `Merge2` (index 1) — this is a parallel branch

---

## Visual Layout

```
                    ┌─→ Redis_GET_lock (existing)
                    │
  parametros ───────┼─→ cancelar_vacuo (existing)
                    │
                    └─→ mapear_tipo_midia → salvar_msg_inbound (NEW)


  Send message ─────┬─→ Merge1 (existing)
                    └─→ salvar_msg_outbound (NEW)

  enviar_botao_cta ─┬─→ Merge1 (existing)
                    └─→ salvar_msg_outbound (NEW)

  Send message 1 ───┬─→ Merge2 (existing)
  (audio)           └─→ salvar_msg_outbound_audio (NEW)
```

---

## Verification Checklist

1. [ ] Send a TEXT message → check `roberto_messages` for 1 inbound (`text`) + N outbound (`text`) rows
2. [ ] Send an AUDIO message → check inbound has `media_type = audio_input` and `content` = transcription
3. [ ] Send a message that triggers CTA button → check outbound has `media_type = text`
4. [ ] Send a message that triggers audio response → check separate `audio_output` row exists
5. [ ] Verify `wamid` is populated on outbound rows
6. [ ] Verify `direction` is correct (`inbound` vs `outbound`)
7. [ ] Verify `phone` matches across inbound/outbound for same conversation
8. [ ] Test failure scenario: temporarily disconnect Supabase → verify main flow still works (continueOnFail)
