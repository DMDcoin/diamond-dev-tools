import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface api_keysAttributes {
  id: number;
  key_hash: string;
  label: string;
  key_type: 'internal' | 'external';
  allowed_origins?: string;
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  enabled?: boolean;
  created_at?: Date;
  last_used_at?: Date;
}

export type api_keysPk = "id";
export type api_keysId = api_keys[api_keysPk];
export type api_keysOptionalAttributes = "id" | "allowed_origins" | "rate_limit_per_minute" | "rate_limit_per_day" | "enabled" | "created_at" | "last_used_at";
export type api_keysCreationAttributes = Optional<api_keysAttributes, api_keysOptionalAttributes>;

export class api_keys extends Model<api_keysAttributes, api_keysCreationAttributes> implements api_keysAttributes {
  id!: number;
  key_hash!: string;
  label!: string;
  key_type!: 'internal' | 'external';
  allowed_origins?: string;
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  enabled?: boolean;
  created_at?: Date;
  last_used_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof api_keys {
    return api_keys.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    key_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    key_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['internal', 'external']]
      }
    },
    allowed_origins: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rate_limit_per_minute: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 60
    },
    rate_limit_per_day: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 10000
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'api_keys',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "api_keys_pkey",
        unique: true,
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "api_keys_key_hash_key",
        unique: true,
        fields: [
          { name: "key_hash" },
        ]
      },
      {
        name: "idx_api_keys_enabled",
        fields: [
          { name: "enabled" },
        ]
      },
      {
        name: "idx_api_keys_hash",
        fields: [
          { name: "key_hash" },
        ]
      },
      {
        name: "idx_api_keys_type",
        fields: [
          { name: "key_type" },
        ]
      },
    ]
  });
  }
}
