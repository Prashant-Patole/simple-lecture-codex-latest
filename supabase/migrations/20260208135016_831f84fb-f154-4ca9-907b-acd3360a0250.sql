-- Batch update chapter orders in O(1) database call
CREATE OR REPLACE FUNCTION update_chapter_orders(
  chapter_ids uuid[],
  new_orders int[]
) RETURNS void AS $$
BEGIN
  UPDATE subject_chapters AS sc
  SET sequence_order = data.new_order
  FROM unnest(chapter_ids, new_orders) AS data(id, new_order)
  WHERE sc.id = data.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Batch update topic orders in O(1) database call
CREATE OR REPLACE FUNCTION update_topic_orders(
  topic_ids uuid[],
  new_orders int[]
) RETURNS void AS $$
BEGIN
  UPDATE subject_topics AS st
  SET sequence_order = data.new_order
  FROM unnest(topic_ids, new_orders) AS data(id, new_order)
  WHERE st.id = data.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Batch update subtopic orders in O(1) database call
CREATE OR REPLACE FUNCTION update_subtopic_orders(
  subtopic_ids uuid[],
  new_orders int[]
) RETURNS void AS $$
BEGIN
  UPDATE subtopics AS s
  SET sequence_order = data.new_order
  FROM unnest(subtopic_ids, new_orders) AS data(id, new_order)
  WHERE s.id = data.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;