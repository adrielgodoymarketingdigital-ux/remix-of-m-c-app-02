alter table produtos add column if not exists preco_atacado numeric(10,2) default null;
alter table pecas    add column if not exists preco_atacado numeric(10,2) default null;
