import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { headers, headersId } from './headers';

export interface pending_validator_state_eventAttributes {
  state: string;
  on_enter_block_number: number;
  on_exit_block_number?: number;
  node: any;
  keygen_round: number;
}

export type pending_validator_state_eventPk = "state" | "on_enter_block_number" | "node" | "keygen_round";
export type pending_validator_state_eventId = pending_validator_state_event[pending_validator_state_eventPk];
export type pending_validator_state_eventOptionalAttributes = "on_exit_block_number";
export type pending_validator_state_eventCreationAttributes = Optional<pending_validator_state_eventAttributes, pending_validator_state_eventOptionalAttributes>;

export class pending_validator_state_event extends Model<pending_validator_state_eventAttributes, pending_validator_state_eventCreationAttributes> implements pending_validator_state_eventAttributes {
  state!: string;
  on_enter_block_number!: number;
  on_exit_block_number?: number;
  node!: any;
  keygen_round!: number;

  // pending_validator_state_event belongsTo headers via on_enter_block_number
  on_enter_block_number_header!: headers;
  getOn_enter_block_number_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setOn_enter_block_number_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createOn_enter_block_number_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;
  // pending_validator_state_event belongsTo headers via on_exit_block_number
  on_exit_block_number_header!: headers;
  getOn_exit_block_number_header!: Sequelize.BelongsToGetAssociationMixin<headers>;
  setOn_exit_block_number_header!: Sequelize.BelongsToSetAssociationMixin<headers, headersId>;
  createOn_exit_block_number_header!: Sequelize.BelongsToCreateAssociationMixin<headers>;

  static initModel(sequelize: Sequelize.Sequelize): typeof pending_validator_state_event {
    return pending_validator_state_event.init({
    state: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    on_enter_block_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    on_exit_block_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'headers',
        key: 'block_number'
      }
    },
    node: {
      type: DataTypes.BLOB,
      allowNull: false,
      primaryKey: true
    },
    keygen_round: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    tableName: 'pending_validator_state_event',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "pending_validator_state_event_pkey",
        unique: true,
        fields: [
          { name: "state" },
          { name: "node" },
          { name: "on_enter_block_number" },
          { name: "keygen_round" },
        ]
      },
    ]
  });
  }
}
