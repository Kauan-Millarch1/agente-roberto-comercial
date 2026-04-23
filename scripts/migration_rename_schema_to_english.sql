-- Migration: rename_schema_to_english
-- Purpose: Standardize all roberto_ tables and columns from Portuguese to English
-- Date: 2026-04-13
-- Based on: actual schema queried from Supabase (not docs)
-- IMPORTANT: Run BEGIN to COMMIT in a single execution in the Supabase SQL Editor

BEGIN;

-- ============================================================
-- STEP 1: Rename columns (while tables still have old names)
-- ============================================================

-- roberto_leads
ALTER TABLE roberto_leads RENAME COLUMN telefone TO phone;
ALTER TABLE roberto_leads RENAME COLUMN nome TO name;
ALTER TABLE roberto_leads RENAME COLUMN evento_interesse TO event_interest;
ALTER TABLE roberto_leads RENAME COLUMN origem_typeform TO typeform_source;
ALTER TABLE roberto_leads RENAME COLUMN perfil_comportamental TO behavioral_profile;

-- roberto_mensagens
ALTER TABLE roberto_mensagens RENAME COLUMN telefone TO phone;
ALTER TABLE roberto_mensagens RENAME COLUMN direcao TO direction;
ALTER TABLE roberto_mensagens RENAME COLUMN conteudo TO content;
ALTER TABLE roberto_mensagens RENAME COLUMN tipo_midia TO media_type;

-- roberto_custos
ALTER TABLE roberto_custos RENAME COLUMN telefone TO phone;
ALTER TABLE roberto_custos RENAME COLUMN modelo TO model;
ALTER TABLE roberto_custos RENAME COLUMN "transcrição_audio_enviado" TO transcription_audio_sent;
ALTER TABLE roberto_custos RENAME COLUMN "transcrição_audio_recebido" TO transcription_audio_received;

-- roberto_metricas
ALTER TABLE roberto_metricas RENAME COLUMN agente_id TO agent_id;
ALTER TABLE roberto_metricas RENAME COLUMN mensagens_texto_enviada TO text_messages_sent;
ALTER TABLE roberto_metricas RENAME COLUMN mensagens_audio_enviada TO audio_messages_sent;
ALTER TABLE roberto_metricas RENAME COLUMN status_conversa TO conversation_status;
ALTER TABLE roberto_metricas RENAME COLUMN id_agendamento TO scheduling_id;
ALTER TABLE roberto_metricas RENAME COLUMN mensagem_arquivo TO file_message;
-- sticker stays (already English)
ALTER TABLE roberto_metricas RENAME COLUMN mensagem_texto_recebido TO text_message_received;
ALTER TABLE roberto_metricas RENAME COLUMN mensagem_audio_recebido TO audio_message_received;
ALTER TABLE roberto_metricas RENAME COLUMN mensagem_imagem_recebido TO image_message_received;
ALTER TABLE roberto_metricas RENAME COLUMN percebeu_ia TO detected_ai;
ALTER TABLE roberto_metricas RENAME COLUMN criado_em TO created_at;

-- roberto_perfis_stats
ALTER TABLE roberto_perfis_stats RENAME COLUMN perfil TO profile;
ALTER TABLE roberto_perfis_stats RENAME COLUMN convertidos TO converted;
ALTER TABLE roberto_perfis_stats RENAME COLUMN perdidos TO lost;

-- roberto_vacuo
ALTER TABLE roberto_vacuo RENAME COLUMN telefone TO phone;
ALTER TABLE roberto_vacuo RENAME COLUMN tentativa TO attempt;
ALTER TABLE roberto_vacuo RENAME COLUMN nome_lead TO lead_name;
ALTER TABLE roberto_vacuo RENAME COLUMN evento_interesse TO event_interest;
ALTER TABLE roberto_vacuo RENAME COLUMN contexto_ultimo TO last_context;
-- execution_id stays (already English)

-- roberto_resumos
ALTER TABLE roberto_resumos RENAME COLUMN telefone TO phone;
ALTER TABLE roberto_resumos RENAME COLUMN resumo TO summary;
ALTER TABLE roberto_resumos RENAME COLUMN estagio TO stage;

-- roberto_descontos
ALTER TABLE roberto_descontos RENAME COLUMN evento_nome TO event_name;
ALTER TABLE roberto_descontos RENAME COLUMN preco_cheio TO full_price;
ALTER TABLE roberto_descontos RENAME COLUMN nivel_1 TO tier_1;
ALTER TABLE roberto_descontos RENAME COLUMN nivel_2 TO tier_2;
ALTER TABLE roberto_descontos RENAME COLUMN maximo_desconto TO max_discount;
ALTER TABLE roberto_descontos RENAME COLUMN formas_pagamento TO payment_methods;

-- ============================================================
-- STEP 2: Rename tables
-- ============================================================

ALTER TABLE roberto_mensagens RENAME TO roberto_messages;
ALTER TABLE roberto_custos RENAME TO roberto_costs;
ALTER TABLE roberto_metricas RENAME TO roberto_metrics;
ALTER TABLE roberto_perfis_stats RENAME TO roberto_profile_stats;
ALTER TABLE roberto_resumos RENAME TO roberto_summaries;
ALTER TABLE roberto_vacuo RENAME TO roberto_vacuum;
ALTER TABLE roberto_descontos RENAME TO roberto_discounts;
-- roberto_leads stays the same

-- ============================================================
-- STEP 3: Rename indexes
-- ============================================================

-- Custom indexes
ALTER INDEX idx_roberto_custos_created_at RENAME TO idx_roberto_costs_created_at;
ALTER INDEX idx_roberto_custos_telefone RENAME TO idx_roberto_costs_phone;
ALTER INDEX idx_roberto_leads_evento RENAME TO idx_roberto_leads_event_interest;
-- idx_roberto_leads_status stays the same
ALTER INDEX idx_roberto_mensagens_created_at RENAME TO idx_roberto_messages_created_at;
ALTER INDEX idx_roberto_mensagens_telefone RENAME TO idx_roberto_messages_phone;
ALTER INDEX idx_roberto_resumos_telefone RENAME TO idx_roberto_summaries_phone;

-- Primary key indexes
ALTER INDEX roberto_custos_pkey RENAME TO roberto_costs_pkey;
ALTER INDEX roberto_descontos_pkey RENAME TO roberto_discounts_pkey;
ALTER INDEX roberto_mensagens_pkey RENAME TO roberto_messages_pkey;
ALTER INDEX roberto_metricas_pkey RENAME TO roberto_metrics_pkey;
ALTER INDEX roberto_perfis_stats_pkey RENAME TO roberto_profile_stats_pkey;
ALTER INDEX roberto_resumos_pkey RENAME TO roberto_summaries_pkey;
ALTER INDEX roberto_vacuo_pkey RENAME TO roberto_vacuum_pkey;
-- roberto_leads_pkey stays the same

-- ============================================================
-- STEP 4: Rename triggers
-- ============================================================

ALTER TRIGGER trg_roberto_perfis_stats_updated_at ON roberto_profile_stats RENAME TO trg_roberto_profile_stats_updated_at;
ALTER TRIGGER trg_roberto_vacuo_updated_at ON roberto_vacuum RENAME TO trg_roberto_vacuum_updated_at;
-- trg_roberto_leads_updated_at stays the same

COMMIT;
