# MER — Sistema de Atendimento de Pronto Socorro

Banco MySQL, 6 tabelas: `usuario`, `paciente`, `atendimento`, `triagem`, `medicamento`, `prescricao`.

```mermaid
erDiagram
    PACIENTE ||--o{ ATENDIMENTO : "procura"
    ATENDIMENTO ||--o| TRIAGEM : "passa"
    ATENDIMENTO ||--o{ PRESCRICAO : "recebe"
    MEDICAMENTO ||--o{ PRESCRICAO : "aparece em"
    USUARIO ||--o{ ATENDIMENTO : "abre (recepcao)"
    USUARIO ||--o{ TRIAGEM : "realiza (enfermagem)"
    USUARIO |o--o{ ATENDIMENTO : "atende (medico)"

    USUARIO {
        int id_usuario PK
        varchar nome
        char cpf UK
        varchar telefone
        varchar email "opcional"
        varchar login UK
        varchar senha_hash "bcrypt"
        varchar perfil "recepcao | enfermagem | medico"
        tinyint ativo "1 = ativo, 0 = inativo"
    }

    PACIENTE {
        int id_paciente PK
        varchar nome_completo
        char cpf UK "cpf ou rg obrigatorio"
        varchar rg UK
        date data_nascimento
        char sexo
        varchar telefone
        varchar endereco
        varchar nome_pai
        varchar nome_mae
    }

    ATENDIMENTO {
        int id_atendimento PK "numero AT0001"
        int id_paciente FK
        varchar status "aberto | triado | atendido | cancelado"
        int id_recepcionista FK
        datetime data_hora_entrada
        int id_medico FK "preenchido no atendimento"
        datetime data_hora_atendimento
        varchar diagnostico
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

    MEDICAMENTO {
        int id_medicamento PK
        varchar nome
        varchar apresentacao "ex: 500 mg comprimido"
        tinyint ativo "1 = na lista, 0 = fora"
    }

    PRESCRICAO {
        int id_prescricao PK
        int id_atendimento FK
        int id_medicamento FK
        varchar dosagem
        varchar frequencia
    }
```

## Relacionamentos

| De | Para | Cardinalidade | Significado |
|---|---|---|---|
| paciente | atendimento | 1 : N | cada ida ao pronto-socorro é um atendimento novo |
| atendimento | triagem | 1 : 0..1 | cada atendimento passa por uma triagem (ainda não existe enquanto `aberto`) |
| atendimento | prescricao | 1 : N | o médico pode passar vários remédios |
| medicamento | prescricao | 1 : N | o mesmo remédio aparece em vários atendimentos |
| usuario (recepção) | atendimento | 1 : N | quem abriu o atendimento |
| usuario (enfermagem) | triagem | 1 : N | quem fez a triagem |
| usuario (médico) | atendimento | 0..1 : N | quem atendeu (vazio até atender) |

`atendimento` e `medicamento` são N : N, e a `prescricao` é a tabela que liga os dois, com a dosagem e a frequência.

## A esteira (campo `status` do atendimento)

| Etapa | Quem | Grava em | Status vira |
|---|---|---|---|
| Recepção | recepcionista | `paciente` + `atendimento` | `aberto` |
| Triagem | enfermagem | `triagem` | `triado` |
| Atendimento | médico | `prescricao` + diagnóstico no `atendimento` | `atendido` |

Pode virar `cancelado` antes de `atendido`. O histórico é uma consulta (`WHERE status = 'atendido'`), não uma tabela.

## Classificação (Protocolo de Manchester)

| Valor | Cor | Urgência |
|---|---|---|
| 1 | Vermelho | emergência |
| 2 | Laranja | muito urgente |
| 3 | Amarelo | urgente |
| 4 | Verde | pouco urgente |
| 5 | Azul | não urgente |
