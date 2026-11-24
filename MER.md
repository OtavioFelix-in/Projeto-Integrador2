# MER — Sistema de Atendimento de Pronto Socorro

Banco MySQL, 4 tabelas: `usuario`, `paciente`, `atendimento`, `triagem`.

```mermaid
erDiagram
    PACIENTE ||--o{ ATENDIMENTO : "procura"
    ATENDIMENTO ||--o| TRIAGEM : "passa"
    USUARIO ||--o{ ATENDIMENTO : "abre (recepcao)"
    USUARIO ||--o{ TRIAGEM : "realiza (enfermagem)"
    USUARIO |o--o{ ATENDIMENTO : "atende (medico)"
    USUARIO |o--o{ ATENDIMENTO : "cancela (recepcao)"

    USUARIO {
        int id_usuario PK
        varchar nome
        char cpf UK
        varchar telefone
        varchar email "opcional"
        varchar login UK
        varchar senha_hash "bcrypt"
        varchar perfil "recepcao | enfermagem | medico | admin"
        tinyint ativo "1 = ativo, 0 = inativo"
    }

    PACIENTE {
        int id_paciente PK
        varchar nome_completo
        char cpf UK "cpf ou rg obrigatorio"
        varchar rg UK
        date data_nascimento "vazio so em nao identificado"
        char sexo
        varchar telefone
        varchar endereco
        varchar nome_pai
        varchar nome_mae
        tinyint nao_identificado "1 = chegou sem documento"
    }

    ATENDIMENTO {
        int id_atendimento PK "numero AT0001"
        int id_paciente FK
        varchar status "aberto | triado | atendido | cancelado"
        int id_recepcionista FK
        datetime data_hora_entrada
        tinyint alerta "1 = sinal grave na chegada"
        int id_medico FK "preenchido no atendimento"
        datetime data_hora_atendimento
        varchar diagnostico
        text receita "texto livre do medico"
        int id_cancelou FK "preenchido no cancelamento"
        datetime data_hora_cancelamento
    }

    TRIAGEM {
        int id_triagem PK
        int id_atendimento FK, UK "1 por atendimento"
        int id_enfermeiro FK
        datetime data_hora
        varchar pressao_arterial
        decimal temperatura
        int batimentos_cardiacos
        varchar queixas
        tinyint classificacao "Manchester 1 a 5"
    }
```

## Relacionamentos

| De | Para | Cardinalidade | Significado |
|---|---|---|---|
| paciente | atendimento | 1 : N | cada ida ao pronto-socorro é um atendimento novo |
| atendimento | triagem | 1 : 0..1 | cada atendimento passa por uma triagem (ainda não existe enquanto `aberto`) |
| usuario (recepção) | atendimento | 1 : N | quem abriu o atendimento |
| usuario (enfermagem) | triagem | 1 : N | quem fez a triagem |
| usuario (médico) | atendimento | 0..1 : N | quem atendeu (vazio até atender) |
| usuario (recepção) | atendimento | 0..1 : N | quem cancelou (vazio se não foi cancelado) |

A receita não é uma tabela: é um texto livre (`receita`) no próprio `atendimento`, porque cada atendimento tem uma só, igual ao diagnóstico.

## Campos que tratam casos especiais

- **`atendimento.alerta`**: a recepção marca quando vê um sinal grave na chegada (sangramento forte, desmaio, falta de ar, dor no peito). Só muda a ordem da fila da triagem. A classificação continua sendo dada pela enfermagem.
- **`paciente.nao_identificado`**: paciente que chegou desacordado ou sem conseguir informar os dados. Nesse caso só o sexo é obrigatório, e `data_nascimento`, `cpf` e `rg` podem ficar vazios. A regra do banco (`ck_paciente_documento`) exige CPF ou RG, a não ser que esse campo esteja marcado.
- **`atendimento.id_cancelou` e `data_hora_cancelamento`**: ficam vazios até a recepção cancelar. Assim dá para saber quem cancelou e quando.

## A esteira (campo `status` do atendimento)

| Etapa | Quem | Grava em | Status vira |
|---|---|---|---|
| Recepção | recepcionista | `paciente` + `atendimento` | `aberto` |
| Triagem | enfermagem | `triagem` | `triado` |
| Atendimento | médico | diagnóstico e receita no `atendimento` | `atendido` |

Pode virar `cancelado` antes de `atendido`. O histórico é uma consulta (`WHERE status IN ('atendido', 'cancelado')`), não uma tabela.

## Classificação (Protocolo de Manchester)

| Valor | Cor | Urgência |
|---|---|---|
| 1 | Vermelho | emergência |
| 2 | Laranja | muito urgente |
| 3 | Amarelo | urgente |
| 4 | Verde | pouco urgente |
| 5 | Azul | não urgente |
